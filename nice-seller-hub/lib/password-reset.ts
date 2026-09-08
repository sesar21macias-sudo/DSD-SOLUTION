import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PBKDF2_ITERATIONS, hashPassword, randomHex } from "./auth";

/**
 * Recuperar una contraseña sin correo saliente.
 *
 * El flujo honesto que se puede sostener hoy: quien administra la plataforma
 * genera un enlace de un solo uso desde el panel y se lo manda a la
 * distribuidora por WhatsApp, que es por donde ya se hablan. No es
 * autoservicio, y no pretende serlo — pero convierte "hay que correr un script
 * desde mi computadora" en "dos toques desde el celular", que es la diferencia
 * entre poder darle cuenta a alguien y no poder.
 *
 * Cuando exista correo saliente, este mismo token se manda solo y el flujo se
 * vuelve autoservicio sin cambiar nada de aqui.
 */

/** Doce horas: suficiente para que lo vea, corto para que no quede rodando. */
const TTL_HOURS = 12;

/**
 * Del token solo se guarda su huella.
 *
 * Un enlace de recuperacion vale exactamente lo mismo que la contraseña. Si se
 * guardara en claro, quien leyera la tabla podria entrar a cualquier cuenta;
 * asi, lo guardado no sirve para nada.
 */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ResetLink {
  token: string;
  expiresAt: string;
}

/**
 * Crea un enlace para una cuenta. Invalida los anteriores: si se generaron dos
 * por error, solo el ultimo debe abrir la puerta.
 */
export async function createResetToken(
  userId: number,
  createdBy: number
): Promise<ResetLink> {
  const db = await getDb();
  const nowIso = new Date().toISOString();

  await db
    .update(schema.passwordResets)
    .set({ usedAt: nowIso })
    .where(and(eq(schema.passwordResets.userId, userId), isNull(schema.passwordResets.usedAt)));

  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3_600_000).toISOString();

  await db.insert(schema.passwordResets).values({
    userId,
    tokenHash: await sha256Hex(token),
    createdBy,
    expiresAt,
  });

  return { token, expiresAt };
}

export interface ResetTarget {
  userId: number;
  name: string;
  email: string;
}

/** El dueño de un token vigente, o null. Nunca lanza: un token raro es null. */
export async function findResetTarget(token: string): Promise<ResetTarget | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const db = await getDb();
  const rows = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.passwordResets)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
    .where(
      and(
        eq(schema.passwordResets.tokenHash, await sha256Hex(token)),
        isNull(schema.passwordResets.usedAt),
        gt(schema.passwordResets.expiresAt, new Date().toISOString())
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Cambia la contraseña y quema el token.
 *
 * El token se marca usado con `used_at is null` en el WHERE: si dos peticiones
 * llegan juntas, solo una lo consume. Y se marca **antes** de escribir la
 * contraseña — si algo fallara despues, lo peor es que haya que generar otro
 * enlace, no que el enlace siga sirviendo.
 */
export async function consumeResetToken(
  token: string,
  newPassword: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "La contraseña necesita al menos 8 caracteres." };
  }

  const target = await findResetTarget(token);
  if (!target) {
    return { ok: false, error: "Este enlace ya no sirve. Pide uno nuevo." };
  }

  const db = await getDb();
  const claimed = await db
    .update(schema.passwordResets)
    .set({ usedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.passwordResets.tokenHash, await sha256Hex(token)),
        isNull(schema.passwordResets.usedAt)
      )
    )
    .returning({ id: schema.passwordResets.id });

  if (claimed.length === 0) {
    return { ok: false, error: "Este enlace ya se usó. Pide uno nuevo." };
  }

  const salt = randomHex(16);
  const hash = await hashPassword(newPassword, salt);

  await db
    .update(schema.users)
    .set({
      passwordHash: hash,
      passwordSalt: salt,
      passwordIterations: PBKDF2_ITERATIONS,
    })
    .where(eq(schema.users.id, target.userId));

  return { ok: true, email: target.email };
}
