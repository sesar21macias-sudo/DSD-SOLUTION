/**
 * Costos y ganancia.
 *
 * Una distribuidora NICE le compra a NICE con un descuento sobre el precio de
 * catalogo. Ese descuento es su negocio entero: la diferencia entre lo que
 * paga y lo que cobra es lo que le queda. Hasta ahora el sistema solo sabia el
 * segundo numero.
 *
 * Aqui viven los calculos puros —sin base de datos— para poder usarlos igual
 * en el servidor y en el navegador mientras ella escribe un precio.
 */

/** Tope razonable. Un descuento de 90% no existe y casi siempre es un dedazo. */
export const MAX_DISCOUNT_PCT = 80;

/**
 * Lo que le cuesta una pieza con su descuento.
 *
 * Se redondea a centavos enteros al final, nunca antes: redondear el
 * porcentaje primero acumula error pieza por pieza y al sumar cincuenta
 * renglones el costo total ya no cuadra con el ticket.
 */
export function costFromCatalog(catalogCents: number, discountPct: number): number {
  if (!Number.isFinite(catalogCents) || catalogCents <= 0) return 0;
  const pct = Math.min(MAX_DISCOUNT_PCT, Math.max(0, Math.round(discountPct)));
  return Math.round((catalogCents * (100 - pct)) / 100);
}

/** La ganancia de vender una pieza. Null si no se sabe cuanto costo. */
export function profitCents(priceCents: number, costCents: number | null): number | null {
  if (costCents === null || !Number.isFinite(costCents)) return null;
  return priceCents - costCents;
}

/**
 * El margen sobre el precio de venta ("de cada $100 que cobro, $X son mios"),
 * no sobre el costo. Es la forma en que se lee un margen en una tienda, y la
 * unica que no da numeros mayores a 100.
 */
export function marginPct(priceCents: number, costCents: number | null): number | null {
  if (costCents === null || priceCents <= 0) return null;
  return Math.round(((priceCents - costCents) / priceCents) * 100);
}

/** "x2.4" — cuantas veces su costo esta cobrando. */
export function markupLabel(priceCents: number, costCents: number | null): string | null {
  if (costCents === null || costCents <= 0) return null;
  return `x${(priceCents / costCents).toFixed(1)}`;
}
