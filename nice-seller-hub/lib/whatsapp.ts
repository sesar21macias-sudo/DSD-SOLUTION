import { formatMoneyMXN } from "./format";
import { renderTemplate } from "./message-templates";

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
  /** Antes del cupon. Solo se imprime si hubo descuento. */
  subtotalCents?: number;
  discountCents?: number;
  couponCode?: string | null;
  couponName?: string | null;
  customerName?: string | null;
  note?: string | null;
  /** Lo que ella escribió para el saludo y el cierre. Null = el de siempre. */
  greetingTemplate?: string | null;
  closingTemplate?: string | null;
}

/**
 * Los asteriscos son el negritas de WhatsApp. El renglon de cada pieza usa el
 * subtotal de la partida (2 aretes de $199 = $398), no el precio unitario:
 * es lo que la persona espera ver sumado en el total.
 */
export function buildOrderMessage(o: WhatsAppOrderMessage): string {
  const lines: string[] = [];

  lines.push(
    renderTemplate("orderGreeting", o.greetingTemplate, { vendedora: o.sellerFirstName })
  );
  lines.push("");
  lines.push("🛍️ *Mi pedido*");
  lines.push("");

  for (const item of o.items) {
    const subtotal = item.unitPriceCents * item.quantity;
    lines.push(`• ${item.quantity}× ${item.name} NICE ${item.code} — ${formatMoneyMXN(subtotal)}`);
  }

  lines.push("");

  // El desglose solo aparece cuando hay algo que desglosar: en un pedido sin
  // cupon, un "Subtotal" seguido de un "Total" identico solo estorba.
  if (o.discountCents && o.discountCents > 0) {
    lines.push(`Subtotal: ${formatMoneyMXN(o.subtotalCents ?? o.totalCents + o.discountCents)}`);
    lines.push(
      `🎁 Cupón${o.couponCode ? ` ${o.couponCode}` : ""}${
        o.couponName ? ` (${o.couponName})` : ""
      }: −${formatMoneyMXN(o.discountCents)}`
    );
    lines.push("");
  }

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
  lines.push(renderTemplate("orderClosing", o.closingTemplate, {}));

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
export function buildShareMessage(
  businessName: string,
  url: string,
  template?: string | null
): string {
  return renderTemplate("shareMessage", template, { tienda: businessName, enlace: url });
}

/** Primer nombre, para saludar sin sonar a formulario. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export interface PointsMessageReward {
  name: string;
  pointsCost: number;
  /** true = ya le alcanza para canjearla ahora mismo. */
  qualifies: boolean;
}

export interface WhatsAppPointsMessage {
  customerFirstName: string;
  businessName: string;
  points: number;
  tierName: string;
  /** Sus recompensas activas, ya evaluadas contra su saldo. */
  rewards: PointsMessageReward[];
  greetingTemplate?: string | null;
  closingTemplate?: string | null;
}

/**
 * El mensaje que ella le manda a una clienta con su saldo y lo que puede
 * canjear ahora mismo.
 *
 * El saludo y el cierre son su voz y se pueden personalizar; el saldo y la
 * lista de recompensas los arma siempre el sistema con lo que hay de verdad en
 * la base — es la misma regla que en el mensaje de pedido: donde hay puntos y
 * precios, no hay redaccion libre que valga mas que la exactitud.
 */
export function buildPointsMessage(o: WhatsAppPointsMessage): string {
  const lines: string[] = [];

  lines.push(
    renderTemplate("pointsGreeting", o.greetingTemplate, {
      cliente: o.customerFirstName,
      tienda: o.businessName,
    })
  );
  lines.push("");
  lines.push(`⭐ *Puntos disponibles: ${o.points}*`);
  lines.push(`🏅 Nivel: ${o.tierName}`);

  if (o.rewards.length > 0) {
    lines.push("");
    lines.push("🎁 *Recompensas*");
    for (const r of o.rewards) {
      const mark = r.qualifies ? "✅" : "🔒";
      const note = r.qualifies
        ? "ya la puedes canjear"
        : `te faltan ${r.pointsCost - o.points} pts`;
      lines.push(`${mark} ${r.name} — ${r.pointsCost} pts (${note})`);
    }
  }

  lines.push("");
  lines.push(renderTemplate("pointsClosing", o.closingTemplate, {}));

  return lines.join("\n");
}
