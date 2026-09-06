import "server-only";

import { getD1 } from "@/db";

/**
 * Limitador de ventana fija sobre D1.
 *
 * Vive en la base y no en memoria porque en un Worker cada request puede caer
 * en un isolate distinto: un contador en memoria no limitaria nada. La ventana
 * fija deja pasar hasta el doble del limite justo en el cambio de ventana, lo
 * cual esta bien para lo que protege —crear pedidos, iniciar sesion—; no es
 * una defensa contra un ataque dedicado, es un freno contra el bucle accidental
 * y el abuso casual.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / windowSeconds) * windowSeconds;
  const key = `${scope}:${identifier}:${windowStart}`;

  try {
    const db = await getD1();
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (key, hits, window_start) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET hits = hits + 1
         RETURNING hits`
      )
      .bind(key, windowStart)
      .first<{ hits: number }>();

    const hits = row?.hits ?? 1;
    return {
      ok: hits <= limit,
      remaining: Math.max(0, limit - hits),
      retryAfterSeconds: windowStart + windowSeconds - nowSec,
    };
  } catch {
    // Si el limitador falla, se deja pasar. Un contador roto no puede tumbar
    // la posibilidad de mandar un pedido: perder una venta es peor que
    // permitir un request de mas.
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/**
 * La IP del cliente segun Cloudflare. `CF-Connecting-IP` la pone el borde y no
 * se puede falsificar desde fuera; `x-forwarded-for` si, por eso va despues y
 * solo como respaldo para desarrollo local.
 */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconocida"
  );
}
