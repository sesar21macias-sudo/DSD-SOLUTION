/**
 * Semáforo compartido por la tele y el panel. Una sola regla para todos:
 * en meta = verde, a pocos puntos = ámbar, más abajo = rojo. Siempre va
 * acompañado de una palabra y un ícono, nunca solo el color.
 */
export type Tone = "good" | "warn" | "bad" | "none";

export function toneFor(value: number | null, goal: number, warnBand: number): Tone {
  if (value === null || !Number.isFinite(value)) return "none";
  if (value >= goal) return "good";
  if (value >= goal - warnBand) return "warn";
  return "bad";
}

/** 0.9575 → "95.8%". Un decimal solo cuando aporta (menos de 100). */
export function pct(ratio: number | null, decimals = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  const v = ratio * 100;
  return `${v >= 100 || decimals === 0 ? Math.round(v) : v.toFixed(decimals)}%`;
}

/** Diferencia en puntos porcentuales entre dos razones: 0.95 vs 0.93 → +2.0 */
export function pointsDelta(now: number | null, before: number | null): number | null {
  if (now === null || before === null) return null;
  return Math.round((now - before) * 1000) / 10;
}

export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}
