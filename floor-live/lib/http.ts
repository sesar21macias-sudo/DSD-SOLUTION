import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./session";
import { errorText, type ErrorKey } from "./i18n/dict";
import { langOfRequest } from "./i18n/server";

/**
 * Envuelve un route handler: los HttpError se vuelven respuestas con su
 * mensaje; cualquier otra cosa es un 500 genérico (el detalle va al log,
 * no al navegador).
 */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      const lang = args[0] instanceof Request ? langOfRequest(args[0]) : "es";
      if (err instanceof HttpError) {
        return NextResponse.json({ error: errorText(lang, err.key, err.args) }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: errorText(lang, "server") }, { status: 500 });
    }
  };
}

export function bad(key: ErrorKey, ...args: unknown[]): never {
  throw new HttpError(400, key, ...args);
}

export function notFound(key: ErrorKey = "notFound"): never {
  throw new HttpError(404, key);
}

export async function body<T>(req: Request): Promise<Partial<T>> {
  return ((await req.json().catch(() => ({}))) ?? {}) as Partial<T>;
}

export function idParam(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return n;
}

export function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

/** YYYY-MM-DD válido o null. */
export function dateOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) bad("invalidDate");
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) bad("invalidDate");
  return v;
}

/** "YYYY-MM-DDTHH:MM" válido (hora local de planta) o null. */
export function localDateTimeOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const s = v.slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) bad("invalidDate");
  const d = new Date(`${s}:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 16) !== s) bad("invalidDate");
  return s;
}

export function intOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad("intRange", min, max);
  return n;
}

export function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

export function numOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) bad("numRange", min, max);
  return n;
}
