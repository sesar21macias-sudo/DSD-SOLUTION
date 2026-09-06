import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  PBKDF2_ITERATIONS,
  SESSION_COOKIE,
  hashPassword,
  randomHex,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth";
import { getSessionSecret } from "@/lib/secret";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Alta de una distribuidora: crea la cuenta y su tienda en el mismo paso.
 * Una cuenta sin tienda no serviria de nada, y pedir dos formularios seguidos
 * es la forma mas facil de perder a alguien antes de que suba su primer
 * producto.
 */

const RESERVED = new Set([
  "admin", "dashboard", "login", "register", "api", "logout", "settings",
  "about", "help", "soporte", "nice", "_next", "favicon.ico", "sitemap.xml",
  "robots.txt", "checkout", "cart", "order", "product",
]);

export async function POST(req: Request) {
  const limit = await rateLimit("register", clientIp(req), 5, 900);
  if (!limit.ok) {
    return bad("Demasiados intentos. Espera unos minutos.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Datos ilegibles.");
  }

  const name = str(body.name, 80);
  const email = str(body.email, 160)?.toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const businessName = str(body.businessName, 80) ?? name;
  const whatsappRaw = str(body.whatsapp, 20);
  const city = str(body.city, 80);
  const requestedSlug = str(body.slug, 40);

  if (!name) return bad("Escribe tu nombre.");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Ese correo no se ve válido.");
  if (password.length < 8) return bad("La contraseña necesita al menos 8 caracteres.");
  if (!whatsappRaw) return bad("Necesitamos tu WhatsApp: es a donde llegan los pedidos.");

  const phone = normalizePhone(whatsappRaw);
  if (!phone.ok) return bad(phone.error ?? "Ese WhatsApp no se ve válido.");

  const slug = slugify(requestedSlug || name);
  if (slug.length < 3) return bad("El enlace de tu tienda necesita al menos 3 letras.");
  if (RESERVED.has(slug)) return bad("Ese enlace está reservado. Elige otro.");

  const db = await getDb();

  const emailTaken = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (emailTaken[0]) return bad("Ya hay una cuenta con ese correo. Inicia sesión.");

  const slugTaken = await db
    .select({ id: schema.sellers.id })
    .from(schema.sellers)
    .where(eq(schema.sellers.slug, slug))
    .limit(1);
  if (slugTaken[0]) return bad(`El enlace "${slug}" ya está ocupado. Prueba con otro.`);

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

  await db.insert(schema.sellers).values({
    userId,
    slug,
    businessName: businessName ?? name,
    whatsapp: phone.value,
    city: city ?? null,
    description: null,
    status: "active",
  });

  const token = await signSession({ uid: userId, role: "seller" }, await getSessionSecret());

  const res = NextResponse.json({ ok: true, slug });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}
