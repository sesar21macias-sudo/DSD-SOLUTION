/**
 * Las reglas del club que no tocan la base.
 *
 * Viven aparte de `loyalty.ts` —que es "server-only"— porque la tarjeta de la
 * clienta y las pantallas de recompensas necesitan estas mismas etiquetas y
 * calculos en el navegador. Es la misma division que ya existe entre
 * `orders.ts` y `order-status.ts`.
 */

// --- Reglas ----------------------------------------------------------------

export const DEFAULT_CENTS_PER_POINT = 1_000; // 1 punto por cada $10
export const MIN_CENTS_PER_POINT = 100; // 1 punto por peso
export const MAX_CENTS_PER_POINT = 100_000; // 1 punto por cada $1,000

export type RewardKind = "percent" | "amount" | "gift";

export const REWARD_KINDS: { id: RewardKind; label: string; hint: string }[] = [
  { id: "percent", label: "% de descuento", hint: "Ej. 10% en su siguiente compra." },
  { id: "amount", label: "Descuento en pesos", hint: "Ej. $150 de descuento." },
  { id: "gift", label: "Regalo o envío gratis", hint: "Sin descuento: tú decides qué le das." },
];

/**
 * Los niveles son fijos y iguales para todas las tiendas: son un lenguaje
 * comun ("soy VIP con mi distribuidora") y ademas evitan una segunda tabla de
 * configuracion para algo que nadie pidio personalizar. Se calculan sobre el
 * acumulado historico, no sobre el saldo: canjear un cupon no debe degradarte.
 */
export interface Tier {
  id: string;
  name: string;
  min: number;
  className: string;
}

export const TIERS: Tier[] = [
  { id: "member", name: "NICE MEMBER", min: 0, className: "bg-neutral-100 text-neutral-600" },
  { id: "gold", name: "NICE GOLD", min: 1_000, className: "bg-amber-100 text-amber-800" },
  { id: "vip", name: "NICE VIP", min: 2_500, className: "bg-neutral-900 text-white" },
];

export function tierFor(points: number): Tier {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

export function pointsToNextTier(points: number): { tier: Tier; missing: number } | null {
  const next = TIERS.find((t) => t.min > points);
  return next ? { tier: next, missing: next.min - points } : null;
}

export function pointsForSale(totalCents: number, centsPerPoint: number): number {
  const rate = centsPerPoint > 0 ? centsPerPoint : DEFAULT_CENTS_PER_POINT;
  return Math.floor(totalCents / rate);
}

/** "1 punto por cada $10" — la regla dicha como la diria una persona. */
export function rateLabel(centsPerPoint: number): string {
  const pesos = Math.round(centsPerPoint / 100);
  return pesos <= 1 ? "1 punto por cada peso" : `1 punto por cada $${pesos}`;
}

/** Lo que descuenta un cupon sobre un subtotal. Nunca mas que el subtotal. */
export function discountFor(kind: string, value: number, subtotalCents: number): number {
  if (kind === "percent") {
    const pct = Math.min(100, Math.max(0, value));
    return Math.min(subtotalCents, Math.round((subtotalCents * pct) / 100));
  }
  if (kind === "amount") return Math.min(subtotalCents, Math.max(0, value));
  return 0;
}

/** "10% de descuento" / "$150 de descuento" / el nombre del regalo. */
export function rewardValueLabel(kind: string, value: number, name: string): string {
  if (kind === "percent") return `${value}% de descuento`;
  if (kind === "amount") return `$${(value / 100).toLocaleString("es-MX")} de descuento`;
  return name;
}

