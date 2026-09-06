/**
 * El estado de una pieza se calcula, nunca se guarda. Guardarlo obligaria a
 * recordarlo en cada venta, cada pedido y cada ajuste manual, y bastaria un
 * olvido para que la tienda publica anunciara como disponible algo que ya no
 * esta. Lo unico que la distribuidora decide a mano es si la pieza se ve.
 */

export type StockStatus = "available" | "last_pieces" | "sold_out" | "hidden";

/** Al llegar a este numero o menos, la pieza se anuncia como "ultimas piezas". */
export const LAST_PIECES_THRESHOLD = 2;

export function stockStatus(stock: number, isVisible: boolean): StockStatus {
  if (!isVisible) return "hidden";
  if (stock <= 0) return "sold_out";
  if (stock <= LAST_PIECES_THRESHOLD) return "last_pieces";
  return "available";
}

export interface StatusLabel {
  label: string;
  /** Clases de Tailwind para el punto y el texto del badge. */
  dot: string;
  text: string;
  /** Si se puede agregar al carrito. */
  buyable: boolean;
}

export const STATUS_LABELS: Record<StockStatus, StatusLabel> = {
  available: {
    label: "Disponible",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    buyable: true,
  },
  last_pieces: {
    label: "Últimas piezas",
    dot: "bg-amber-500",
    text: "text-amber-700",
    buyable: true,
  },
  sold_out: {
    label: "Agotado",
    dot: "bg-neutral-400",
    text: "text-neutral-500",
    buyable: false,
  },
  hidden: {
    label: "Oculto",
    dot: "bg-neutral-300",
    text: "text-neutral-400",
    buyable: false,
  },
};

/** Texto para el detalle de producto: "Quedan 2 piezas". */
export function stockHint(stock: number): string {
  if (stock <= 0) return "Sin piezas disponibles";
  if (stock === 1) return "Queda 1 pieza";
  if (stock <= LAST_PIECES_THRESHOLD) return `Quedan ${stock} piezas`;
  return `${stock} piezas disponibles`;
}

/** Umbral para la alerta de "inventario bajo" del panel. */
export const LOW_STOCK_THRESHOLD = 2;

export const MOVEMENT_LABELS: Record<string, string> = {
  add: "Producto agregado",
  increase: "Stock aumentado",
  decrease: "Stock reducido",
  sale: "Venta",
  remove: "Producto eliminado",
  hide: "Producto ocultado",
  show: "Producto visible",
};
