import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TV_COOKIE, TV_COOKIE_DAYS, displayBySecret, refreshCode, startPairing } from "@/lib/displays";
import { handler } from "@/lib/http";
import { HttpError } from "@/lib/session";

/**
 * La tele pide (o renueva) su código. Sin sesión: es la única puerta abierta,
 * por eso no devuelve nada más que el código y está topada en altas pendientes.
 */
export const POST = handler(async (req: Request) => {
  const jar = await cookies();
  const current = await displayBySecret(jar.get(TV_COOKIE)?.value);

  if (current?.status === "active") return NextResponse.json({ status: "active" });
  if (current) {
    const fresh =
      current.pair_code && current.pair_expires && Date.parse(current.pair_expires) > Date.now() + 30_000
        ? { code: current.pair_code, expires: current.pair_expires }
        : await refreshCode(current.id);
    return NextResponse.json({ status: "pending", ...fresh });
  }

  const started = await startPairing();
  if (!started) throw new HttpError(429, "tooManyPending");
  const res = NextResponse.json({ status: "pending", code: started.code, expires: started.expires });
  res.cookies.set(TV_COOKIE, started.secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: TV_COOKIE_DAYS * 86_400,
  });
  return res;
});
