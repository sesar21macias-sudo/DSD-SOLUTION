import { DEFECTS, type JobInput } from "./types";

/*
 * Reglas de un trabajo, compartidas por la subida del Excel y por el editor de
 * trabajos del panel: lo que entra por cualquiera de los dos caminos se valida igual.
 */

export function int(v: unknown, max = 1_000_000): number {
  // Vacío = 0 (campos opcionales como rechazadas o retrabajo).
  const n = v === undefined || v === null || v === "" ? 0 : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error("bad");
  return Math.round(n);
}
export function num(v: unknown, max = 1_000_000): number {
  const n = v === undefined || v === null || v === "" ? 0 : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error("bad");
  return Math.round(n * 100) / 100;
}
export function str(v: unknown, max: number, required = false): string {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  if (required && !s) throw new Error("bad");
  // Sin caracteres de control: estos textos acaban en la tele.
  return s.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

/** Valida un trabajo (del Excel o capturado a mano). Lanza Error si algo no cuadra. */
export function cleanJob(raw: Partial<JobInput>): JobInput {
  const closed = typeof raw.closed_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.closed_on) ? raw.closed_on : null;
  const inspected = int(raw.inspected);
  const passed = Math.min(int(raw.passed), inspected);
  const defects = Object.fromEntries(
    DEFECTS.map((d) => [d, int((raw.defects as Record<string, unknown> | undefined)?.[d] ?? 0)])
  ) as JobInput["defects"];
  const week = int(raw.week, 53);
  if (week < 1) throw new Error("bad");
  return {
    week,
    job: str(raw.job, 40, true),
    team: str(raw.team, 20, true).toUpperCase(),
    part: str(raw.part, 80),
    units: int(raw.units),
    inspected,
    rejected: int(raw.rejected),
    passed,
    est_hours: num(raw.est_hours),
    act_hours: num(raw.act_hours),
    rework_hours: num(raw.rework_hours),
    defects,
    closed_on: closed,
  };
}

/** Equipos numerados primero (ELP01, ELP02…), luego el resto en orden alfabético. */
export function teamOrder(a: string, b: string): number {
  const na = /^ELP0*(\d{1,2})$/.exec(a)?.[1];
  const nb = /^ELP0*(\d{1,2})$/.exec(b)?.[1];
  if (na && nb) return Number(na) - Number(nb);
  if (na) return -1;
  if (nb) return 1;
  return a.localeCompare(b);
}

/** Nombre inicial para un código nuevo: ELP01 → "Team 1"; los demás, tal cual. */
export function defaultName(code: string): string {
  const m = /^ELP0*(\d{1,2})$/.exec(code);
  return m ? `Team ${Number(m[1])}` : code;
}

