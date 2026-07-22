import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAdminSession } from "@/lib/auth";
import {
  createCalendarEvent,
  createDriveFile,
  deleteCalendarEvent,
  listDriveFolder,
  listUpcomingEvents,
  appendToGoogleDoc,
  type DriveFileKind,
} from "@/lib/google";
import { MINISTRIES, getMinistryBySlug, type Ministry } from "@/lib/ministryFolders";
import {
  OBJETIVO_GENERAL,
  OBJETIVOS_ESPECIFICOS,
  RESPONSABILIDADES_FIJAS,
  PADRE_ASESOR,
  MATRIMONIO_ASESOR,
} from "@/data/asesores";

export const maxDuration = 120;

const MAX_TURNS = 8;

function buildSystemPrompt(ministry: Ministry, admin: boolean): string {
  const roster = MINISTRIES.map(
    (m) => `- ${m.nombre}: Coordi. ${m.coordinador} · Sub. ${m.subcoordinador}`,
  ).join("\n");

  const hoy = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Mexico_City",
  });

  return `Soy Irvinasio, el compa de confianza de ${ministry.nombre}. Ayudo a armar actividades y documentos sin complicaciones.

SÉ NATURAL: Habla como amigo del equipo. Nada de "A continuación", "Cabe destacar", frases corporativas. Sé directo, propositivo, con humor donde cabe.

DOS MODOS:
1. ACTIVIDADES: Preguntas qué quieren hacer → sugiero estructura completa (cuándo, cuántos, materiales, roles)
2. DOCUMENTOS: "Necesito un documento de..." → entrevista natural (1 pregunta por turno), documento profesional

DOCUMENTOS: Formato clean (Títulos 18pt azul #1F4E79, texto 11pt), tablas bonitas (cronograma, recursos, roles), nunca inventes datos.

CONTEXTO: ${ministry.nombre} · Coordi. ${ministry.coordinador} · ${hoy}

${
  admin
    ? "Eres ADMIN: agranda eventos del calendario directo si dan fecha/hora. Si falta lugar, pregunta rápido."
    : "No eres admin: citas ven calendario, pero agendas las pide un admin. Sigue ayudando igual."
}

VIBE: Cálido, práctico, sin rodeos. Propón, estructura, avanza.`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_calendario",
    description:
      "Consulta los próximos eventos del calendario oficial de la Pastoral Juvenil. Úsala cuando pregunten por fechas, eventos o disponibilidad.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "crear_evento",
    description:
      "Crea un evento en el Google Calendar oficial del equipo. Solo funciona si el usuario es administrador. La hora es en formato 24h de la zona de México.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título del evento" },
        fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
        hora: { type: "string", description: "Hora en formato HH:mm (24h)" },
        lugar: { type: "string", description: "Lugar del evento" },
      },
      required: ["titulo", "fecha", "hora", "lugar"],
    },
  },
  {
    name: "borrar_evento",
    description:
      "Borra un evento del calendario por su id (obtén el id con consultar_calendario). Solo administradores.",
    input_schema: {
      type: "object",
      properties: {
        eventoId: { type: "string", description: "Id del evento a borrar" },
      },
      required: ["eventoId"],
    },
  },
  {
    name: "crear_documento",
    description:
      "Crea un archivo de Google (documento, hoja de cálculo o presentación) en la carpeta de Drive del ministerio activo. Para documentos de texto puedes incluir contenido inicial.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["doc", "sheet", "slides"],
          description: "doc = Google Docs, sheet = Google Sheets, slides = Google Slides",
        },
        nombre: { type: "string", description: "Nombre del archivo" },
        contenido: {
          type: "string",
          description: "Solo para tipo doc: texto inicial del documento (ej. la minuta o el plan completo)",
        },
      },
      required: ["tipo", "nombre"],
    },
  },
  {
    name: "listar_archivos",
    description:
      "Lista los archivos recientes de la carpeta de Drive del ministerio activo, con sus enlaces.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

async function runTool(
  name: string,
  input: Record<string, unknown>,
  ministry: Ministry,
  admin: boolean,
): Promise<{ content: string; isError?: boolean }> {
  try {
    switch (name) {
      case "consultar_calendario": {
        const events = await listUpcomingEvents();
        if (events.length === 0) return { content: "No hay eventos próximos en el calendario." };
        return {
          content: events
            .map(
              (e) =>
                `- [id: ${e.id}] ${e.titulo} — ${e.fecha} ${e.hora} h en ${e.lugar} (ministerio: ${e.ministrySlug})`,
            )
            .join("\n"),
        };
      }
      case "crear_evento": {
        if (!admin) {
          return {
            content:
              "El usuario no es administrador: no se puede crear el evento. Ofrece dejarle los datos listos.",
            isError: true,
          };
        }
        const event = await createCalendarEvent({
          titulo: String(input.titulo),
          fecha: String(input.fecha),
          hora: String(input.hora),
          lugar: String(input.lugar),
          ministrySlug: ministry.slug,
        });
        return {
          content: `Evento creado: ${event.titulo} el ${event.fecha} a las ${event.hora} en ${event.lugar}. Enlace: ${event.htmlLink ?? "(en el calendario del equipo)"}`,
        };
      }
      case "borrar_evento": {
        if (!admin) {
          return { content: "El usuario no es administrador: no se puede borrar.", isError: true };
        }
        await deleteCalendarEvent(String(input.eventoId));
        return { content: "Evento borrado del calendario." };
      }
      case "crear_documento": {
        const tipo = String(input.tipo) as DriveFileKind;
        const kind: DriveFileKind = tipo === "doc" || tipo === "sheet" || tipo === "slides" ? tipo : "doc";
        const file = await createDriveFile({
          kind,
          name: String(input.nombre),
          folderId: ministry.driveFolderId,
        });
        if (kind === "doc" && typeof input.contenido === "string" && input.contenido.trim()) {
          await appendToGoogleDoc(file.id, input.contenido);
        }
        return { content: `Archivo creado: "${file.name}". Enlace: ${file.webViewLink}` };
      }
      case "listar_archivos": {
        const files = await listDriveFolder(ministry.driveFolderId);
        if (files.length === 0) return { content: "La carpeta del ministerio está vacía." };
        return {
          content: files
            .map((f) => `- ${f.name} (${f.mimeType.split(".").pop()}) → ${f.webViewLink ?? "sin enlace"}`)
            .join("\n"),
        };
      }
      default:
        return { content: `Herramienta desconocida: ${name}`, isError: true };
    }
  } catch (err) {
    console.error(`Tool ${name} failed`, err);
    return { content: `La herramienta falló: ${err instanceof Error ? err.message : "error"}`, isError: true };
  }
}

type ChatTurn = { role: "usuario" | "agente"; text: string };

// ---------------------------------------------------------------------------
// Proveedor Claude (Anthropic)
// ---------------------------------------------------------------------------

async function runClaudeAgent(
  turnsIn: ChatTurn[],
  ministry: Ministry,
  admin: boolean,
): Promise<string> {
  const client = new Anthropic();
  const model = process.env.AGENT_MODEL ?? "claude-haiku-4-5";
  // El thinking adaptativo solo existe en modelos 4.6+ (Opus/Sonnet); Haiku 4.5 lo rechaza
  const supportsAdaptiveThinking = /opus-4-[678]|sonnet-(5|4-6)|fable/.test(model);

  const messages: Anthropic.MessageParam[] = turnsIn.map((m) => ({
    role: m.role === "usuario" ? "user" : "assistant",
    content: m.text,
  }));

  let turns = 0;
  while (turns < MAX_TURNS) {
    turns += 1;
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      ...(supportsAdaptiveThinking ? { thinking: { type: "adaptive" as const } } : {}),
      system: buildSystemPrompt(ministry, admin),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = await runTool(
        block.name,
        (block.input ?? {}) as Record<string, unknown>,
        ministry,
        admin,
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "Hice varias acciones seguidas y me quedé sin turnos. Revisa el calendario o el Drive y dime cómo seguimos.";
}

// ---------------------------------------------------------------------------
// Proveedor Gemini (Google, capa gratuita)
// ---------------------------------------------------------------------------

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

/** Convierte el JSON Schema de nuestras tools al formato OpenAPI de Gemini. */
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      out.type = value.toUpperCase();
    } else if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, Record<string, unknown>>).map(([k, v]) => [
          k,
          toGeminiSchema(v),
        ]),
      );
    } else if (key === "items" && value && typeof value === "object") {
      out.items = toGeminiSchema(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const GEMINI_TOOLS = [
  {
    functionDeclarations: TOOLS.map((t) => {
      const params = toGeminiSchema(t.input_schema as Record<string, unknown>);
      const hasProps =
        params.properties && Object.keys(params.properties as object).length > 0;
      return {
        name: t.name,
        description: t.description,
        // Gemini rechaza objetos sin propiedades: se omite parameters en tools sin argumentos
        ...(hasProps ? { parameters: params } : {}),
      };
    }),
  },
];

async function runGeminiAgent(
  turnsIn: ChatTurn[],
  ministry: Ministry,
  admin: boolean,
  model: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents: GeminiContent[] = turnsIn.map((m) => ({
    role: m.role === "usuario" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  let turns = 0;
  while (turns < MAX_TURNS) {
    turns += 1;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: buildSystemPrompt(ministry, admin) }] },
        contents,
        tools: GEMINI_TOOLS,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      // 429 = sin cuota, 503/500 = saturado, 404 = modelo retirado → probar respaldo
      if ([429, 500, 503, 404].includes(res.status)) {
        throw new Error(`gemini-unavailable(${res.status}): ${errText.slice(0, 200)}`);
      }
      throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length === 0) {
      return parts
        .map((p) => p.text ?? "")
        .join("")
        .trim();
    }

    contents.push({ role: "model", parts });

    const responses: GeminiPart[] = [];
    for (const part of functionCalls) {
      const call = part.functionCall!;
      const result = await runTool(call.name, call.args ?? {}, ministry, admin);
      responses.push({
        functionResponse: {
          name: call.name,
          response: result.isError ? { error: result.content } : { resultado: result.content },
        },
      });
    }
    contents.push({ role: "user", parts: responses });
  }

  return "Hice varias acciones seguidas y me quedé sin turnos. Revisa el calendario o el Drive y dime cómo seguimos.";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Por defecto usa Gemini (gratis) si hay key; Claude queda como respaldo.
  const provider =
    process.env.AGENT_PROVIDER ?? (process.env.GEMINI_API_KEY ? "gemini" : "claude");

  if (provider === "claude" && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: true,
      reply:
        "Todavía no estoy conectado a mi cerebro (falta configurar la API key en el servidor). Pídele al admin que la configure y con gusto te ayudo a planear lo que necesites.",
    });
  }

  let body: { messages?: ChatTurn[]; ministrySlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const ministry = getMinistryBySlug(body.ministrySlug ?? "");
  if (!ministry || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });
  }

  const admin = await isAdminSession();

  // Limites para cuidar los creditos: historial acotado y mensajes recortados
  const turns: ChatTurn[] = body.messages.slice(-16).map((m) => ({
    role: m.role,
    text: String(m.text).slice(0, 4000),
  }));

  try {
    let reply: string;
    if (provider === "gemini") {
      // Cadena de respaldo: Flash → Flash-Lite (menos saturado) → Claude si hay key
      const geminiModels = [
        process.env.GEMINI_MODEL ?? "gemini-flash-latest",
        "gemini-flash-lite-latest",
      ];
      let result: string | null = null;
      let lastError: unknown = null;
      for (const geminiModel of geminiModels) {
        try {
          result = await runGeminiAgent(turns, ministry, admin, geminiModel);
          break;
        } catch (err) {
          lastError = err;
          if (err instanceof Error && err.message.startsWith("gemini-unavailable")) {
            console.warn(`Gemini ${geminiModel} no disponible; probando respaldo`);
            continue;
          }
          throw err;
        }
      }
      if (result === null) {
        if (process.env.ANTHROPIC_API_KEY) {
          console.warn("Gemini agotado; usando Claude de respaldo");
          result = await runClaudeAgent(turns, ministry, admin);
        } else {
          throw lastError;
        }
      }
      reply = result;
    } else {
      reply = await runClaudeAgent(turns, ministry, admin);
    }

    return NextResponse.json({
      ok: true,
      reply: reply || "No supe qué responder, ¿me lo repites de otra forma?",
    });
  } catch (err) {
    console.error("POST /api/agent", err);
    return NextResponse.json(
      {
        ok: false,
        error: "El agente tuvo un problema. Intenta de nuevo en un momento.",
        // Solo los admins ven el detalle técnico, para diagnosticar
        ...(admin && err instanceof Error ? { detail: err.message.slice(0, 500) } : {}),
      },
      { status: 502 },
    );
  }
}
