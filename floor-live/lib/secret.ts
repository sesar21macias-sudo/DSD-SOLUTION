import { getEnv } from "./env";
import { randomHex } from "./auth";

const KEY = "session_secret";

/**
 * La llave con la que se firman las sesiones se genera sola la primera vez
 * y vive en la base. Así no hay un secreto más que administrar a mano, y no
 * queda hardcodeada en el repo.
 *
 * Se cachea a nivel de isolate: la mayoría de los requests no tocan la base.
 */
let cached: string | null = null;

export async function getSessionSecret(): Promise<string> {
  if (cached) return cached;

  const env = await getEnv();
  const db = env.DB;

  const existing = await db
    .prepare("SELECT value FROM app_config WHERE key = ?")
    .bind(KEY)
    .first<{ value: string }>();

  if (existing?.value) {
    cached = existing.value;
    return cached;
  }

  // Dos requests simultáneos pueden llegar aquí a la vez; el INSERT OR IGNORE
  // deja que gane uno solo y después ambos leen el mismo valor.
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
