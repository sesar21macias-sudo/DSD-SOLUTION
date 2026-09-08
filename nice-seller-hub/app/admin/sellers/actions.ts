"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { createResetToken } from "@/lib/password-reset";

/**
 * Genera el enlace de recuperación de una distribuidora.
 *
 * Solo un admin puede hacerlo, y el `userId` se comprueba contra la tabla de
 * tiendas: un id escrito a mano no puede apuntar a otra cuenta cualquiera.
 */
export async function generateResetLink(
  userId: number
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const admin = await requireAdmin();

  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, error: "Cuenta inválida." };
  }

  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.sellers)
    .innerJoin(schema.users, eq(schema.users.id, schema.sellers.userId))
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!rows[0]) return { ok: false, error: "Esa cuenta no tiene tienda." };

  const { token } = await createResetToken(userId, admin.id);

  // El dominio sale del request: funciona igual en producción y en local, sin
  // una variable de entorno más que mantener.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";

  return { ok: true, url: `${protocol}://${host}/recuperar/${token}` };
}
