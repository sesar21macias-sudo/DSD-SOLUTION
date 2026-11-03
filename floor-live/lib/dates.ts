/**
 * Zona horaria de la planta (El Paso, hora de montaña). "Hoy" para los días
 * sin accidente y la vigencia de los anuncios se calcula aquí, no en UTC.
 */
export const PLANT_TZ = "America/Denver";

export function todayInTz(tz = PLANT_TZ, now = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "Ahora" en la planta como "YYYY-MM-DDTHH:MM" (mismo formato que la programación). */
export function nowInTz(tz = PLANT_TZ, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Suma minutos a un "YYYY-MM-DDTHH:MM" de planta (aritmética en UTC: no cambia la zona). */
export function addMinutes(local: string, minutes: number): string {
  const d = new Date(`${local}:00Z`);
  return new Date(d.getTime() + minutes * 60_000).toISOString().slice(0, 16);
}

export type ScheduleState = "live" | "scheduled" | "ended";

/** Si algo programado está en pantalla ahora, todavía no sale o ya se quitó. */
export function scheduleState(startsAt: string | null, endsAt: string | null, now = nowInTz()): ScheduleState {
  if (endsAt && endsAt <= now) return "ended";
  if (startsAt && startsAt > now) return "scheduled";
  return "live";
}

/** "nov 3, 7:00 a.m." en el idioma de quien lo ve; la hora ya es de planta. */
export function formatLocal(local: string, locale: string): string {
  const d = new Date(`${local}:00Z`);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}

/** Días completos desde la fecha hasta hoy (0 si es hoy). */
export function daysSince(date: string, today = todayInTz()): number {
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** "Nov 2026" / "nov 2026" a partir de "2026-11". */
export function monthName(ym: string, locale: string, style: "long" | "short" = "long"): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return "";
  const s = new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
