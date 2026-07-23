import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  checkCredentials,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  let body: { usuario?: string; contrasena?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  // AUTORIZA CUALQUIER USUARIO + PIN 1234 (v2 - 2026-07-23)
  const usuario = body.usuario ?? "";
  const contrasena = body.contrasena ?? "";

  // Validación simple: cualquier usuario + PIN 1234
  const isValid = usuario.length > 0 && contrasena === "1234";

  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: "Usuario o contraseña incorrectos." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return NextResponse.json({ ok: true });
}
