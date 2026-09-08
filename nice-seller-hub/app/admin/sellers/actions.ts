"use server";

import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { createResetToken } from "@/lib/password-reset";
import {
  ADMIN_RETURN_COOKIE,
  PBKDF2_ITERATIONS,
  SESSION_COOKIE,
  hashPassword,
  randomHex,
  signSession,
} from "@/lib/auth";
import { getSessionSecret } from "@/lib/secret";
import { normalizePhone } from "@/lib/phone";
import { RESERVED_SLUGS, slugify } from "@/lib/format";

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

// --- Alta de una distribuidora nueva ---------------------------------------

const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Una contraseña temporal, generada — no una que el admin tenga que inventar. */
function generateTempPassword(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

export interface NewSellerInput {
  name: string;
  businessName: string;
  email: string;
  whatsapp: string;
  city?: string;
  slug?: string;
  planPriceCents?: number;
}

export type NewSellerResult =
  | { ok: true; email: string; password: string; slug: string; whatsapp: string }
  | { ok: false; error: string };

/**
 * El admin da de alta una cuenta directamente, ya sin registro público.
 *
 * Genera la contraseña — no la escribe el admin — y la devuelve una sola vez
 * junto con el correo, para mandarlas por WhatsApp. No queda guardada en
 * claro en ningún lado: como el reset de contraseña, si se pierde, se da de
 * alta con otra.
 */
export async function createSellerAccount(input: NewSellerInput): Promise<NewSellerResult> {
  await requireAdmin();

  const name = input.name.trim().slice(0, 80);
  const businessName = (input.businessName || name).trim().slice(0, 80);
  const email = input.email.trim().slice(0, 160).toLowerCase();
  const city = input.city?.trim().slice(0, 80) || null;

  if (!name) return { ok: false, error: "Falta el nombre." };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Ese correo no se ve válido." };
  }

  const phone = normalizePhone(input.whatsapp);
  if (!phone.ok) return { ok: false, error: phone.error ?? "Ese WhatsApp no se ve válido." };

  const slug = slugify(input.slug?.trim() || businessName || name);
  if (slug.length < 3) return { ok: false, error: "El enlace necesita al menos 3 letras." };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "Ese enlace está reservado." };

  const db = await getDb();

  const emailTaken = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (emailTaken[0]) return { ok: false, error: "Ya hay una cuenta con ese correo." };

  const slugTaken = await db
    .select({ id: schema.sellers.id })
    .from(schema.sellers)
    .where(eq(schema.sellers.slug, slug))
    .limit(1);
  if (slugTaken[0]) return { ok: false, error: `El enlace "${slug}" ya está ocupado.` };

  const password = generateTempPassword();
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);

  const users = await db
    .insert(schema.users)
    .values({
      name,
      email,
      phone: phone.value,
      role: "seller",
      passwordHash,
      passwordSalt: salt,
      passwordIterations: PBKDF2_ITERATIONS,
    })
    .returning({ id: schema.users.id });

  const userId = users[0].id;
  const planPriceCents = Number.isFinite(input.planPriceCents) ? Math.max(0, input.planPriceCents!) : 0;

  await db.insert(schema.sellers).values({
    userId,
    slug,
    businessName,
    whatsapp: phone.value,
    city,
    status: "active",
    planStatus: "trial",
    planPriceCents,
  });

  return { ok: true, email, password, slug, whatsapp: phone.value };
}

// --- Plan / cobro ------------------------------------------------------------

/**
 * Marca a una distribuidora como pagada un mes más. El admin decide cuándo
 * —no hay cobro automático— asi que esto es literalmente "ya me pagó, corre
 * el fecha".
 */
export async function markSellerPaid(sellerId: number): Promise<void> {
  await requireAdmin();
  const db = await getDb();

  const rows = await db
    .select({ paidUntil: schema.sellers.planPaidUntil })
    .from(schema.sellers)
    .where(eq(schema.sellers.id, sellerId))
    .limit(1);
  if (!rows[0]) return;

  const today = new Date();
  const base = rows[0].paidUntil ? new Date(rows[0].paidUntil) : today;
  const from = base > today ? base : today;
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);

  await db
    .update(schema.sellers)
    .set({
      planStatus: "active",
      planPaidUntil: next.toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.sellers.id, sellerId));
}

export async function setSellerPlanPrice(sellerId: number, cents: number): Promise<void> {
  await requireAdmin();
  if (!Number.isFinite(cents) || cents < 0) return;
  const db = await getDb();
  await db
    .update(schema.sellers)
    .set({ planPriceCents: Math.round(cents), updatedAt: new Date().toISOString() })
    .where(eq(schema.sellers.id, sellerId));
}

// --- Entrar como soporte -----------------------------------------------------

/**
 * El admin entra a la tienda de una distribuidora para dar soporte, sin
 * conocer ni cambiar su contraseña.
 *
 * La sesion de admin no se destruye: se guarda en una cookie aparte, de vida
 * corta, para poder volver con "Volver a admin" sin tener que iniciar sesion
 * otra vez. Queda un rastro en los logs del servidor (quién entró, a qué
 * tienda y cuándo) — no hay todavía una bitácora dentro de la app.
 */
export async function impersonateSeller(sellerId: number): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();

  const rows = await (await getDb())
    .select({ userId: schema.sellers.userId, slug: schema.sellers.slug })
    .from(schema.sellers)
    .where(eq(schema.sellers.id, sellerId))
    .limit(1);

  const target = rows[0];
  if (!target) return { ok: false, error: "Esa tienda no existe." };

  console.log(
    `[soporte] admin=${admin.id} entró como seller=${sellerId} (/${target.slug}) — ${new Date().toISOString()}`
  );

  const secret = await getSessionSecret();
  const sellerToken = await signSession({ uid: target.userId, role: "seller" }, secret);
  const returnToken = await signSession({ uid: admin.id, role: "admin" }, secret, 1 / 24);

  const jar = await cookies();
  jar.set(ADMIN_RETURN_COOKIE, returnToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 3600,
  });
  jar.set(SESSION_COOKIE, sellerToken, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 30 * 86_400 });

  return { ok: true };
}

/** Deshace `impersonateSeller`: vuelve a la sesion de admin guardada. */
export async function returnToAdmin(): Promise<{ ok: boolean }> {
  const jar = await cookies();
  const token = jar.get(ADMIN_RETURN_COOKIE)?.value;
  if (!token) return { ok: false };

  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 30 * 86_400 });
  jar.delete(ADMIN_RETURN_COOKIE);
  return { ok: true };
}
