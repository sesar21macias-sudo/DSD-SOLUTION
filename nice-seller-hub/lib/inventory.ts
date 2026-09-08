/**
 * El estado de una pieza se calcula, nunca se guarda. Guardarlo obligaria a
 * recordarlo en cada venta, cada pedido y cada ajuste manual, y bastaria un
 * olvido para que la tienda publica anunciara como disponible algo que ya no
 * esta. Lo unico que la distribuidora decide a mano es si la pieza se ve.
 */

export type StockStatus =
  | "available"
  | "last_pieces"
  | "reserved"
  | "sold_out"
  | "hidden";

/** Al llegar a este numero o menos, la pieza se anuncia como "ultimas piezas". */
export const LAST_PIECES_THRESHOLD = 2;

/**
 * `available` son las piezas libres para quien esta mirando: el stock menos lo
 * que otra persona tiene apartado en este momento. Se pasa solo desde la tienda
 * publica; en el panel la distribuidora quiere ver sus existencias reales, no
 * las que le quedarian a una clienta.
 *
 * "Apartada" y "Agotado" se distinguen a proposito. Agotado significa que ya no
 * hay; apartada significa "alguien la esta comprando, vuelve en un rato". Son
 * dos cosas distintas para quien la queria.
 */
export function stockStatus(
  stock: number,
  isVisible: boolean,
  available?: number
): StockStatus {
  if (!isVisible) return "hidden";
  if (stock <= 0) return "sold_out";
  if (available !== undefined && available <= 0) return "reserved";

  const free = available ?? stock;
  if (free <= LAST_PIECES_THRESHOLD) return "last_pieces";
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
  reserved: {
    label: "Apartada",
    dot: "bg-violet-400",
    text: "text-violet-700",
    buyable: false,
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

/**
 * Lo que se le dice a quien llega y encuentra la pieza apartada.
 *
 * Nunca "agotado": es mentira y ademas la desanima de volver. Lo que hay que
 * decirle es que alguien esta a media compra y que puede regresar.
 */
export function reservedHint(stock: number, available: number): string {
  const taken = Math.max(0, stock - available);
  if (stock === 1 || taken >= stock) {
    return "Alguien la está comprando en este momento. Vuelve en unos minutos.";
  }
  return `Hay ${taken} apartadas en este momento. Vuelve en unos minutos.`;
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
