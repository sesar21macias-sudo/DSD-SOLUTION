import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  SESSION_COOKIE,
  hashPassword,
  safeEqual,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth";
import { getSessionSecret } from "@/lib/secret";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limit = await rateLimit("login", clientIp(req), 10, 300);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail();
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return fail();

  const db = await getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const user = rows[0];

  // Mismo mensaje si el correo no existe o si la contraseña esta mal: decir
  // cual de las dos fallo le regala a cualquiera una lista de correos validos.
  if (!user) return fail();

  const attempt = await hashPassword(password, user.passwordSalt, user.passwordIterations);
  if (!safeEqual(attempt, user.passwordHash)) return fail();

  const token = await signSession({ uid: user.id, role: user.role }, await getSessionSecret());

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

function fail() {
  return NextResponse.json(
    { ok: false, error: "Correo o contraseña incorrectos." },
    { status: 401 }
  );
}
