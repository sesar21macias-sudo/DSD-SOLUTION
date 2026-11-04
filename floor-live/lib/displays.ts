import "server-only";
import { randomHex } from "./auth";
import { first, run } from "./db";

/*
 * Cómo se da de alta una tele, sin teclear contraseñas con el control remoto:
 *  1. La tele abre /tv. Si no trae cookie, pide un alta: el servidor genera un
 *     secreto de 256 bits (cookie httpOnly, solo esta tele lo conoce; la base
 *     guarda su SHA-256) y un código de 6 letras que vence en 15 minutos.
 *  2. El admin, ya con sesión, teclea ese código en Pantallas y elige qué mostrar.
 *  3. La tele, que pregunta cada pocos segundos, recibe su contenido.
 * Quitar la pantalla en el panel borra el renglón: la cookie deja de servir.
 */

export const TV_COOKIE = "fl_tv";
export const TV_COOKIE_DAYS = 400;
const PAIR_MINUTES = 15;
const MAX_PENDING = 30;
// Sin 0/O ni 1/I/L: se lee desde lejos y se dicta sin confusiones.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pairCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  // 256 no es múltiplo de 31: se descarta el sesgo rechazando bytes altos.
  let out = "";
  let i = 0;
  while (out.length < 6) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes);
      i = 0;
    }
    const b = bytes[i++];
    if (b < 248) out += ALPHABET[b % ALPHABET.length];
  }
  return out;
}

export function normalizeCode(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export interface DisplayRow {
  id: number;
  name: string;
  status: "pending" | "active";
  scope: "plant" | "team";
  team_id: number | null;
  lang: "en" | "es";
  slide_seconds: number;
  hidden_slides: string;
  pair_code: string | null;
  pair_expires: string | null;
  last_seen: string | null;
}

export async function displayBySecret(secret: string | undefined): Promise<DisplayRow | null> {
  if (!secret || !/^[0-9a-f]{64}$/.test(secret)) return null;
  return first<DisplayRow>("SELECT * FROM displays WHERE secret_hash = ?", await sha256Hex(secret));
}

/** Alta nueva: devuelve el secreto (va a la cookie) y el código a mostrar. null si hay demasiadas pendientes. */
export async function startPairing(): Promise<{ secret: string; code: string; expires: string } | null> {
  // Las altas que nadie reclamó en un día se limpian solas.
  await run("DELETE FROM displays WHERE status = 'pending' AND created_at < ?", new Date(Date.now() - 86_400_000).toISOString());
  const pending = await first<{ n: number }>("SELECT COUNT(*) AS n FROM displays WHERE status = 'pending'");
  if ((pending?.n ?? 0) >= MAX_PENDING) return null;

  const secret = randomHex(32);
  const expires = new Date(Date.now() + PAIR_MINUTES * 60_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = pairCode();
    try {
      await run(
        "INSERT INTO displays (secret_hash, pair_code, pair_expires) VALUES (?, ?, ?)",
        await sha256Hex(secret),
        code,
        expires
      );
      return { secret, code, expires };
    } catch {
      // Choque de código (improbable): se intenta con otro.
    }
  }
  return null;
}

/** La tele ya pendiente pide código nuevo porque el anterior venció. */
export async function refreshCode(id: number): Promise<{ code: string; expires: string }> {
  const expires = new Date(Date.now() + PAIR_MINUTES * 60_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = pairCode();
    try {
      await run("UPDATE displays SET pair_code = ?, pair_expires = ? WHERE id = ? AND status = 'pending'", code, expires, id);
      return { code, expires };
    } catch {
      /* choque de código: otro intento */
    }
  }
  throw new Error("no code");
}

/** Marca que la tele sigue viva, como mucho una escritura cada 5 minutos. */
export async function touch(d: DisplayRow): Promise<void> {
  if (d.last_seen && Date.now() - Date.parse(d.last_seen) < 5 * 60_000) return;
  await run("UPDATE displays SET last_seen = ? WHERE id = ?", new Date().toISOString(), d.id);
}
