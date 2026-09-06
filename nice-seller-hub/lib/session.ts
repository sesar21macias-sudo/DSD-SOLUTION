import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Seller, User } from "@/db/schema";
import { SESSION_COOKIE, readSession } from "./auth";
import { getSessionSecret } from "./secret";

/**
 * Este archivo es la unica puerta por la que se sabe "quien esta pidiendo
 * esto". Todo lo demas —cada pagina del panel, cada endpoint— saca de aqui el
 * `sellerId` y lo mete en el WHERE. Ningun id de distribuidora llega jamas
 * desde el navegador; si llegara, bastaria con cambiarlo en el devtools para
 * leer el inventario de otra persona.
 */

export class UnauthorizedError extends Error {
  constructor(message = "Necesitas iniciar sesion.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No tienes acceso a esto.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await readSession(token, await getSessionSecret());
  if (!claims) return null;

  const db = await getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, claims.uid)).limit(1);
  return rows[0] ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export interface SellerSession {
  user: User;
  seller: Seller;
}

/**
 * La sesion de una distribuidora. Devuelve el registro completo, no solo el
 * id, porque el panel casi siempre necesita tambien el slug y el WhatsApp.
 *
 * Una cuenta suspendida no pasa: puede iniciar sesion pero no operar.
 */
export async function requireSeller(): Promise<SellerSession> {
  const user = await requireUser();

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.sellers)
    .where(eq(schema.sellers.userId, user.id))
    .limit(1);

  const seller = rows[0];
  if (!seller) throw new ForbiddenError("Esta cuenta todavia no tiene una tienda.");
  if (seller.status !== "active") {
    throw new ForbiddenError("Tu cuenta esta suspendida. Contacta al administrador.");
  }
  return { user, seller };
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}
