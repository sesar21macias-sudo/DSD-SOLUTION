/**
 * Los mensajes de WhatsApp que arma el sistema, hechos de plantillas.
 *
 * Es codigo puro —sin base de datos— para poder usarse tanto en el servidor,
 * donde se arma el mensaje de verdad, como en el navegador, si algun dia hace
 * falta una vista previa.
 *
 * Cada plantilla es la "voz" de un mensaje: el saludo, el motivo, el cierre.
 * Lo que NUNCA se vuelve editable son los renglones con dinero — precios,
 * folio, totales del pedido — porque esos los arma el sistema con lo que de
 * verdad hay en la base, y una plantilla libre ahi podria acabar prometiendo
 * un precio que ya no es el vigente.
 */

export const DEFAULT_TEMPLATES = {
  orderGreeting:
    "Hola {vendedora} 👋\n\nMe gustaría pedir los siguientes productos de tu tienda:",
  orderClosing: "¿Me puedes confirmar disponibilidad y cómo puedo realizar la compra?\n\nGracias.",
  shareMessage: "✨ Visita mi tienda\n\n{tienda} — piezas disponibles para entrega inmediata.\n\n{enlace}",
  paymentReminder:
    "Hola {cliente} 👋 Te escribo de {tienda}. Te recuerdo que tu apartado tiene un saldo de {saldo}. ¿Cuándo te queda bien pasar?",
  couponMessage: "Hola {vendedora} 👋 Quiero usar mi cupón del club:\n\n🎁 {recompensa}\nCódigo: {codigo}",
  pointsGreeting: "Hola {cliente} 👋 Aquí tienes tus puntos con {tienda}:",
  pointsClosing: "¡Sigue comprando para juntar más! Cualquier duda, aquí estoy.",
} as const;

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

export interface PlaceholderInfo {
  token: string;
  label: string;
}

/** Que puede usar cada plantilla y donde vive en el producto. */
export const TEMPLATE_META: Record<
  TemplateKey,
  { title: string; hint: string; placeholders: PlaceholderInfo[]; rows: number }
> = {
  orderGreeting: {
    title: "Al inicio del pedido",
    hint: "Lo primero que dice el mensaje que tu clienta te manda al pedir. Después de esto va la lista de piezas y el total, siempre exactos.",
    placeholders: [{ token: "vendedora", label: "tu primer nombre" }],
    rows: 3,
  },
  orderClosing: {
    title: "Al final del pedido",
    hint: "Lo último del mensaje, después del folio.",
    placeholders: [],
    rows: 2,
  },
  shareMessage: {
    title: "Al compartir tu tienda",
    hint: "El mensaje que sale cuando tú compartes tu enlace por WhatsApp o Facebook.",
    placeholders: [
      { token: "tienda", label: "el nombre de tu tienda" },
      { token: "enlace", label: "tu enlace" },
    ],
    rows: 4,
  },
  paymentReminder: {
    title: "Recordatorio de abono",
    hint: "El mensaje que le mandas a una clienta con saldo pendiente, desde el detalle de su venta.",
    placeholders: [
      { token: "cliente", label: "el nombre de tu clienta" },
      { token: "tienda", label: "el nombre de tu tienda" },
      { token: "saldo", label: "lo que le falta pagar" },
    ],
    rows: 3,
  },
  couponMessage: {
    title: "Al canjear un cupón",
    hint: "El mensaje que tu clienta te manda al usar un cupón del club.",
    placeholders: [
      { token: "vendedora", label: "tu primer nombre" },
      { token: "recompensa", label: "el nombre de la recompensa" },
      { token: "codigo", label: "el código del cupón" },
    ],
    rows: 3,
  },
  pointsGreeting: {
    title: "Al mandarle sus puntos",
    hint: "Lo primero del mensaje que tú le mandas a una clienta con sus puntos y sus recompensas. Después de esto va su saldo y la lista, siempre exactos.",
    placeholders: [
      { token: "cliente", label: "el nombre de tu clienta" },
      { token: "tienda", label: "el nombre de tu tienda" },
    ],
    rows: 2,
  },
  pointsClosing: {
    title: "Al final de ese mensaje",
    hint: "Lo último, después de la lista de recompensas.",
    placeholders: [],
    rows: 2,
  },
};

export const TEMPLATE_MAX_LENGTH = 400;

/**
 * Sustituye `{token}` por su valor. Un token que no viene en `vars` se deja
 * tal cual en vez de borrarlo — es mas facil notar "{typo}" en el mensaje que
 * adivinar por que desaparecio un pedazo de texto.
 */
export function renderTemplate(
  key: TemplateKey,
  custom: string | null | undefined,
  vars: Record<string, string>
): string {
  const template = custom?.trim() || DEFAULT_TEMPLATES[key];
  const filled = template.replace(/\{(\w+)\}/g, (match, token: string) => vars[token] ?? match);
  // Un placeholder vacio ("cliente" sin nombre) deja un hueco de dos espacios
  // donde iba la palabra. Se cierra sin tocar los saltos de linea, que si
  // importan para el formato del mensaje.
  return filled.replace(/[^\S\n]{2,}/g, " ");
}
