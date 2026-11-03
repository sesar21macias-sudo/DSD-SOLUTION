import "server-only";
import { first, run } from "./db";

/**
 * Freno de intentos fallidos por clave (usuario, IP). Vive en D1: es lento
 * comparado con un KV, pero solo se toca cuando alguien falla al entrar.
 */
const WINDOW_MS = 15 * 60_000;
/**
 * 8 fallos por usuario. Por IP el tope es más alto a propósito: toda la planta
 * sale a internet por la misma IP, y con 8 bastaría que una persona se equivoque
 * para dejar fuera a todos (y a las teles) durante 15 minutos.
 */
export const MAX_PER_USER = 8;
export const MAX_PER_IP = 30;

export async function isLocked(key: string, max = MAX_PER_USER): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const row = await first<{ n: number }>(
    "SELECT COUNT(*) AS n FROM auth_failures WHERE key = ? AND created_at > ?",
    key,
    since
  );
  return (row?.n ?? 0) >= max;
}

export async function recordFailure(key: string): Promise<void> {
  await run("INSERT INTO auth_failures (key) VALUES (?)", key);
  // Limpieza oportunista de lo viejo.
  if (Math.random() < 0.05) {
    await run("DELETE FROM auth_failures WHERE created_at < ?", new Date(Date.now() - 86_400_000).toISOString());
  }
}

export async function clearFailures(key: string): Promise<void> {
  await run("DELETE FROM auth_failures WHERE key = ?", key);
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
