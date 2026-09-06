import "server-only";

import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export { schema };

/**
 * Una instancia de Drizzle sobre el D1 del Worker. No se cachea entre
 * requests: el binding pertenece al contexto del request y guardarlo en una
 * variable de modulo lo dejaria colgando de un isolate reutilizado.
 */
export async function getDb(): Promise<DrizzleD1Database<typeof schema>> {
  const env = await getEnv();
  return drizzle(env.DB, { schema });
}

/** El binding crudo, para los pocos casos que necesitan SQL a mano. */
export async function getD1(): Promise<D1Database> {
  return (await getEnv()).DB;
}
