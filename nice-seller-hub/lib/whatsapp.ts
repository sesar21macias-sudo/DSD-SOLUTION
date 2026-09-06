import { formatMoneyMXN } from "./format";

/**
 * El mensaje de WhatsApp es el producto. Todo el resto de la aplicacion existe
 * para que este texto llegue bien escrito al telefono correcto.
 */

export interface WhatsAppLineItem {
  name: string;
  code: string;
  quantity: number;
  /** Precio unitario en centavos. */
  unitPriceCents: number;
}

export interface WhatsAppOrderMessage {
  sellerFirstName: string;
  orderNumber: string;
  items: WhatsAppLineItem[];
  totalCents: number;
  customerName?: string | null;
  note?: string | null;
}

/**
 * Los asteriscos son el negritas de WhatsApp. El renglon de cada pieza usa el
 * subtotal de la partida (2 aretes de $199 = $398), no el precio unitario:
 * es lo que la persona espera ver sumado en el total.
 */
export function buildOrderMessage(o: WhatsAppOrderMessage): string {
  const lines: string[] = [];

  lines.push(`Hola ${o.sellerFirstName} 👋`);
  lines.push("");
  lines.push("Me gustaría pedir los siguientes productos de tu tienda NICE:");
  lines.push("");
  lines.push("🛍️ *Mi pedido*");
  lines.push("");

  for (const item of o.items) {
    const subtotal = item.unitPriceCents * item.quantity;
    lines.push(`• ${item.quantity}× ${item.name} NICE ${item.code} — ${formatMoneyMXN(subtotal)}`);
  }

  lines.push("");
  lines.push(`💰 *Total: ${formatMoneyMXN(o.totalCents)}*`);
  lines.push("");
  lines.push(`📋 Pedido: #${o.orderNumber}`);

  if (o.customerName) {
    lines.push("");
    lines.push(`Mi nombre: ${o.customerName}`);
  }
  if (o.note) {
    lines.push("");
    lines.push(`Nota: ${o.note}`);
  }

  lines.push("");
  lines.push("¿Me puedes confirmar disponibilidad y cómo puedo realizar la compra?");
  lines.push("");
  lines.push("Gracias.");

  return lines.join("\n");
}

/**
 * El enlace oficial. `wa.me` resuelve solo entre la app instalada y WhatsApp
 * Web segun el dispositivo, asi que no hay que detectar la plataforma.
 *
 * `encodeURIComponent` es obligatorio: sin el, el primer `&` o `#` del mensaje
 * corta el texto a la mitad.
 */
export function waLink(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

/** El texto para compartir la tienda (boton "Compartir mi tienda"). */
export function buildShareMessage(businessName: string, url: string): string {
  return `✨ Visita mi tienda NICE\n\n${businessName} — joyería disponible para entrega inmediata.\n\n${url}`;
}

/** Primer nombre, para saludar sin sonar a formulario. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
