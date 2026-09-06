import "server-only";

import { getEnv } from "./env";
import { randomHex } from "./auth";

const KEY = "session_secret";

/**
 * La llave con la que se firman las sesiones se genera sola la primera vez y
 * vive en la base. Asi no hay un secreto mas que administrar a mano ni queda
 * hardcodeado en el repo.
 *
 * Se cachea por isolate: la mayoria de los requests no tocan la base.
 */
let cached: string | null = null;

export async function getSessionSecret(): Promise<string> {
  if (cached) return cached;

  const db = (await getEnv()).DB;

  const existing = await db
    .prepare("SELECT value FROM app_config WHERE key = ?")
    .bind(KEY)
    .first<{ value: string }>();

  if (existing?.value) {
    cached = existing.value;
    return cached;
  }

  // Dos requests simultaneos pueden llegar aqui a la vez; el INSERT OR IGNORE
  // deja que gane uno solo y despues ambos leen el mismo valor.
  const fresh = randomHex(32);
  await db
    .prepare("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)")
    .bind(KEY, fresh)
    .run();

  const settled = await db
    .prepare("SELECT value FROM app_config WHERE key = ?")
    .bind(KEY)
    .first<{ value: string }>();

  cached = settled?.value ?? fresh;
  return cached;
}
