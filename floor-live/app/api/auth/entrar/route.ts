import { NextResponse } from "next/server";
import { first } from "@/lib/db";
import { SESSION_DAYS, hashPassword, normalizeUsername, safeEqual } from "@/lib/auth";
import { withSession } from "@/lib/accounts";
import { body, handler } from "@/lib/http";
import { errorText } from "@/lib/i18n/dict";
import { langOfRequest } from "@/lib/i18n/server";
import { MAX_PER_IP, clearFailures, clientIp, isLocked, recordFailure } from "@/lib/ratelimit";
import type { UserRow } from "@/lib/types";

export const POST = handler(async (req: Request) => {
  const b = await body<{ username: string; password: string }>(req);
  const username = normalizeUsername(String(b.username ?? "")).slice(0, 40);
  const password = String(b.password ?? "").slice(0, 200);
  const lang = langOfRequest(req);

  if (!username || !password) {
    return NextResponse.json({ error: errorText(lang, "loginMissing") }, { status: 400 });
  }

  // Dos frenos: por usuario (adivinar la clave de alguien) y por IP (probar muchos usuarios).
  const userKey = `u:${username}`;
  const ipKey = `ip:${clientIp(req)}`;
  if ((await isLocked(userKey)) || (await isLocked(ipKey, MAX_PER_IP))) {
    return NextResponse.json({ error: errorText(lang, "loginLocked") }, { status: 429 });
  }

  const user = await first<UserRow>("SELECT * FROM users WHERE username = ?", username);

  // Mismo mensaje y misma espera para usuario inexistente, contraseña mala o
  // cuenta desactivada: no le decimos a nadie cuál de las tres falló.
  const fail = async () => {
    await recordFailure(userKey);
    await recordFailure(ipKey);
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: errorText(lang, "loginFailed") }, { status: 401 });
  };

  if (!user || !user.active) return fail();
  const hash = await hashPassword(password, user.password_salt, user.iterations);
  if (!safeEqual(hash, user.password_hash)) return fail();

  await clearFailures(userKey);
  // Una cuenta de pantalla vive en una tele: que no caduque a los 60 días y deje el login en la pared.
  return withSession(NextResponse.json({ ok: true }), user.id, req, user.display_only ? 400 : SESSION_DAYS);
});
