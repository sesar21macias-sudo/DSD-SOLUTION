/**
 * Los estados de un pedido y como se ven.
 *
 * Viven aparte de `lib/orders.ts` porque la lista de pedidos del panel corre
 * en el navegador y necesita estas etiquetas; si las importara del modulo que
 * abre la base, se llevaria el binding de D1 al bundle del cliente.
 */

export const ORDER_STATUSES = [
  "pending",
  "whatsapp_sent",
  "confirmed",
  "preparing",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  whatsapp_sent: "Enviado por WhatsApp",
  confirmed: "Confirmado",
  preparing: "Preparando",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  whatsapp_sent: "bg-emerald-50 text-emerald-700",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-amber-50 text-amber-700",
  delivered: "bg-neutral-900 text-white",
  cancelled: "bg-red-50 text-red-600",
};

export function isOrderStatus(v: string): v is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(v);
}
