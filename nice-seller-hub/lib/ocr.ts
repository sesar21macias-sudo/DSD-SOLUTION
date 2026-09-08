import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";
import { NICE_CODE_RE } from "./nice-code";

/**
 * Lectura del ticket de NICE.
 *
 * Se le pide al modelo una sola cosa —qué piezas y cuántas— y se le prohíbe
 * inventar: un código adivinado se convierte en piezas que la distribuidora
 * cree tener y que sus clientes van a pedir. Por eso cada renglón viene con el
 * texto crudo que se leyó y una marca de confianza, y por eso nada de esto
 * toca el inventario sin que una persona lo confirme.
 *
 * Las reglas de abajo salen de un ticket real, no de suposiciones: la columna
 * se llama "Id Nice", las cantidades vienen como "1.000", el precio de catálogo
 * viene impreso y la descripción va en el renglón de abajo del código.
 */

/**
 * El esquema de salida, escrito a mano.
 *
 * No se usa `zodOutputFormat`: con zod v4 ese helper genera un JSON Schema
 * corrupto —mete el `enum` y el `$schema` dentro de `description`— y la API
 * responde 400 sin cuerpo, que es de los errores más difíciles de diagnosticar.
 * Escribirlo a mano quita esa dependencia de versiones y deja el contrato a la
 * vista.
 */
const TICKET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "problem", "declaredItems", "lines"],
  properties: {
    readable: {
      type: "boolean",
      description: "false si la imagen no es un ticket de NICE o no se alcanza a leer.",
    },
    problem: {
      type: "string",
      description:
        "Si readable es false, una frase corta en español explicando qué pasó. Vacío si readable es true.",
    },
    declaredItems: {
      type: "integer",
      description: "El número impreso en TOTAL ARTICULOS. 0 si no lo trae o no se lee.",
    },
    lines: {
      type: "array",
      description: "Un elemento por renglón de producto.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "quantity", "description", "catalogPrice", "rawLine", "confidence"],
        properties: {
          code: {
            type: "string",
            description: "El Id Nice tal como aparece impreso, sin espacios.",
          },
          quantity: {
            type: "integer",
            description:
              "Piezas de ese renglón. La columna Cant trae '1.000', que es 1 pieza.",
          },
          description: {
            type: "string",
            description:
              "La descripción del renglón (ARETES, COLLAR...). Va en el renglón de abajo del código. Vacío si no la hay.",
          },
          catalogPrice: {
            type: "number",
            description:
              "El Precio Catálogo en pesos, como número (319.00 → 319). 0 si no existe o está vacío.",
          },
          rawLine: {
            type: "string",
            description: "El renglón completo del ticket, tal cual se lee.",
          },
          confidence: {
            type: "string",
            enum: ["high", "low"],
            description:
              "high solo si cada carácter del Id Nice se lee sin ambigüedad. low si hay borrones, el renglón está cortado, o el último carácter podría ser 1, I o L.",
          },
        },
      },
    },
  },
} as const;

interface ParsedTicket {
  readable: boolean;
  problem: string;
  declaredItems: number;
  lines: {
    code: string;
    quantity: number;
    description: string;
    catalogPrice: number;
    rawLine: string;
    confidence: string;
  }[];
}

export type TicketLine = {
  code: string;
  quantity: number;
  description: string;
  catalogPriceCents: number | null;
  rawLine: string;
  confidence: "high" | "low";
};

const SYSTEM = `Lees tickets y notas de remisión de NICE, una marca mexicana de joyería, para una distribuidora que está dando de alta lo que acaba de recibir.

Extraes, por cada renglón de producto: el Id Nice, la cantidad, la descripción y el precio de catálogo.

CÓMO SON ESTOS TICKETS
La tabla de productos tiene estas columnas, en este orden:
  Cant | Id Nice | Precio Catalogo | Precio Unitario | Importe
- "Cant" viene con decimales: "1.000" significa UNA pieza, "2.000" significa DOS. Nunca leas "1.000" como mil.
- "Id Nice" es el código de la pieza. Suele tener 6 u 8 caracteres.
- **Los anillos llevan la talla pegada al código, separada por una diagonal**: "426307/6" es el modelo 426307 en talla 6. Transcribe la diagonal y la talla tal cual; sin ellas la pieza queda incompleta, porque dos tallas del mismo anillo son dos piezas distintas.
- "Precio Catalogo" es el precio de lista ($319.00). "Precio Unitario" e "Importe" suelen venir en 0.00 porque la distribuidora no paga en ese momento; ignóralos.
- La DESCRIPCIÓN del producto (ARETES, COLLAR, PULSERA...) va en el renglón de ABAJO del código, no en el mismo renglón. Es parte del mismo producto.
- Puede haber un recuadro o casilla □ al inicio de cada renglón. Es solo tinta, ignórala.

EL CARÁCTER FINAL DEL Id Nice
Muchos Id Nice terminan en una letra que indica la variante. En papel térmico, esa letra final se confunde con un dígito: "1", "I" y "L" se ven casi idénticos. Cuando el último carácter pueda ser cualquiera de esos tres, transcribe el que más se parezca Y marca confidence "low". No lo resuelvas por tu cuenta: quien revisa tiene el ticket en la mano.

REGLAS QUE NO PUEDES ROMPER
- Nunca inventes un Id Nice. Si un carácter no se distingue, transcribe lo que ves y marca confidence "low".
- Nunca inventes una cantidad. Si el renglón no la trae, usa 1.
- Ignora todo lo que no sea un renglón de producto: encabezado de la tienda, RFC, dirección, orden, factura, descuento, puntos generados, fecha, cajero, EIN, nombre y dirección del destinatario, presentador, código de barras.
- Ignora también el bloque de totales: TOTAL PRECIO CAT., SUBTOTAL, MANEJO, IMPUESTOS, ENVIO, TOTAL, PROYECTOS ESPECIALES. La única excepción es TOTAL ARTICULOS, que sí devuelves en declaredItems.
- Si el mismo Id Nice aparece en dos renglones, devuelve los dos: quien revisa decide si los junta.
- Si la foto no es un ticket, está muy borrosa, o está cortada de forma que no se puedan leer los renglones, devuelve readable=false y explica el problema en una frase.`;

export interface OcrResult {
  ok: boolean;
  lines: TicketLine[];
  /** El TOTAL ARTICULOS impreso, para verificar que no se perdio un renglon. */
  declaredItems: number | null;
  /** Mensaje para la persona cuando algo salio mal. */
  error?: string;
}

/** Formatos que aceptamos desde la camara o la galeria del telefono. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export function isAcceptedImageType(v: string): v is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(v);
}

function fail(error: string): OcrResult {
  return { ok: false, lines: [], declaredItems: null, error };
}

export async function readTicket(
  base64Image: string,
  mediaType: AcceptedImageType
): Promise<OcrResult> {
  const env = await getEnv();
  const apiKey = env.ANTHROPIC_API_KEY;

  // Una clave de Anthropic ronda los 100 caracteres. Si lo guardado es mucho
  // más corto, el secret quedó mal escrito —pasa al pegarlo en una terminal— y
  // conviene decirlo así en vez de dejar que la API responda un 400 sin cuerpo,
  // que no explica nada.
  if (!apiKey || apiKey.trim().length < 40) {
    return fail(
      "La lectura de tickets no está bien configurada. Avisa al administrador."
    );
  }

  /**
   * Se recorta: un secret pegado desde una terminal puede llevar un salto de
   * línea o un espacio al final, y eso convierte la cabecera en inválida. El
   * borde HTTP la rechaza con un 400 sin cuerpo, que no dice nada.
   */
  const client = new Anthropic({ apiKey: apiKey.trim() });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Image },
            },
            {
              type: "text",
              text: "Extrae los renglones de producto de este ticket NICE.",
            },
          ],
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: TICKET_SCHEMA },
      },
    });

    // Una negativa del modelo llega como respuesta 200; hay que revisarla antes
    // de leer el contenido.
    if (response.stop_reason === "refusal") {
      return fail("No pudimos procesar esa imagen. Intenta con otra foto del ticket.");
    }

    // Con output_config la respuesta llega como un bloque de texto que contiene
    // el JSON. Si viniera malformado, se trata como ilegible en vez de reventar.
    const text = response.content.find((b) => b.type === "text");
    let parsed: ParsedTicket | null = null;
    try {
      parsed = text && text.type === "text" ? (JSON.parse(text.text) as ParsedTicket) : null;
    } catch {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.lines)) {
      return fail(
        "No pudimos leer el ticket. Intenta con una foto más cercana y con buena luz."
      );
    }

    if (!parsed.readable) {
      return fail(
        parsed.problem?.trim() ||
          "No se alcanza a leer el ticket. Intenta con más luz y sin sombras encima."
      );
    }

    // Se limpia aqui y no se confia en el modelo: codigos vacios, cantidades
    // absurdas o precios negativos no deben llegar a la revision.
    const lines: TicketLine[] = parsed.lines
      .map((l) => {
        const price = Number(l.catalogPrice);
        return {
          code: String(l.code ?? "").trim().toUpperCase().replace(/\s+/g, ""),
          quantity: Math.min(999, Math.max(1, Math.round(Number(l.quantity) || 1))),
          description: String(l.description ?? "").trim().slice(0, 80),
          catalogPriceCents:
            Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null,
          rawLine: String(l.rawLine ?? "").slice(0, 200),
          confidence: l.confidence === "low" ? ("low" as const) : ("high" as const),
        };
      })
      .filter((l) => NICE_CODE_RE.test(l.code))
      .slice(0, 120);

    if (lines.length === 0) {
      return fail("No encontramos códigos NICE en esa foto. ¿Es el ticket completo?");
    }

    const declared = Math.round(Number(parsed.declaredItems) || 0);

    return {
      ok: true,
      lines,
      declaredItems: declared > 0 ? declared : null,
    };
  } catch (err) {
    // Los errores tecnicos no se le enseñan a nadie; van a los logs del Worker.
    // Nunca se registra la clave ni parte de ella; solo lo que sirve para
    // diagnosticar desde `wrangler tail`.
    const detail = err as { status?: number; error?: unknown; message?: string };
    console.error(
      "readTicket",
      "status=", detail?.status,
      "message=", detail?.message,
      "error=", JSON.stringify(detail?.error)?.slice(0, 400)
    );

    if (err instanceof Anthropic.AuthenticationError) {
      return fail("La lectura de tickets no está bien configurada. Avisa al administrador.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return fail("Hay muchas lecturas en curso. Espera un momento e intenta otra vez.");
    }
    return fail("No pudimos leer el ticket. Intenta otra vez o captura los códigos a mano.");
  }
}
