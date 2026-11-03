import "server-only";
import { getEnv } from "./env";

/**
 * SQL directo sobre D1. Las consultas de este tablero son agregados
 * (avance por orden, carga por persona); escritas a mano se leen mejor
 * que a través de un ORM y no esconden subconsultas correlacionadas.
 */
export async function getD1(): Promise<D1Database> {
  return (await getEnv()).DB;
}

export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const db = await getD1();
  const res = await db.prepare(sql).bind(...params).all<T>();
  return res.results ?? [];
}

export async function first<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  const db = await getD1();
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null;
}

export async function run(sql: string, ...params: unknown[]): Promise<D1Result> {
  const db = await getD1();
  return db.prepare(sql).bind(...params).run();
}

export function nowIso(): string {
  return new Date().toISOString();
}
