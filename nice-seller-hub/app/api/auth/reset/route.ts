import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { getSessionSecret } from "@/lib/secret";
import { consumeResetToken } from "@/lib/password-reset";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Cambia la contraseña con un enlace de recuperacion.
 *
 * El limite por IP importa aqui mas que en otros lados: sin el, alguien podria
 * probar tokens al azar. Con 64 caracteres hexadecimales adivinarlo es
 * imposible, pero el limite es lo que hace que ni valga la pena intentarlo.
 */
export async function POST(req: Request) {
  const limit = await rateLimit("reset", clientIp(req), 10, 600);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  let body: { token?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Petición ilegible." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const result = await consumeResetToken(token, password);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  // Se abre la sesion enseguida. Mandarla a escribir otra vez la contraseña
  // que acaba de elegir es la clase de paso que hace que la gente se rinda.
  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, result.email))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return NextResponse.json({ ok: true, redirect: "/login" });
  }

  const sessionToken = await signSession(
    { uid: user.id, role: user.role },
    await getSessionSecret()
  );

  const res = NextResponse.json({
    ok: true,
    redirect: user.role === "admin" ? "/admin" : "/dashboard",
  });
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return res;
}
