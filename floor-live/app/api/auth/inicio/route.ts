import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { normalizeUsername, safeEqual, validatePassword, validateUsername } from "@/lib/auth";
import { newPasswordFields, withSession } from "@/lib/accounts";
import { bad, body, handler, text } from "@/lib/http";
import { HttpError } from "@/lib/session";
import { clientIp, isLocked, recordFailure } from "@/lib/ratelimit";

/**
 * Crea la primera cuenta (administrador). Solo funciona mientras no exista
 * ningún usuario y con la clave SETUP_CODE del Worker: así nadie que llegue
 * antes que tú al dominio recién desplegado se queda con las pantallas.
 */
export const POST = handler(async (req: Request) => {
  const env = await getEnv();
  const expected = env.SETUP_CODE ?? "";
  if (!expected) throw new HttpError(503, "setupMissing");

  const existing = await first<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  if ((existing?.n ?? 0) > 0) throw new HttpError(409, "setupDone");

  const b = await body<{ code: string; name: string; username: string; password: string }>(req);
  const ipKey = `setup:${clientIp(req)}`;
  if (await isLocked(ipKey)) throw new HttpError(429, "loginLocked");
  if (!safeEqual(String(b.code ?? ""), expected)) {
    await recordFailure(ipKey);
    bad("setupBadCode");
  }

  const name = text(b.name, 60);
  const username = normalizeUsername(b.username ?? "");
  const password = String(b.password ?? "");
  if (!name) bad("nameRequired");
  const uErr = validateUsername(username);
  if (uErr) bad(uErr);
  const pErr = validatePassword(password);
  if (pErr) bad(pErr);

  const pw = await newPasswordFields(password);
  const res = await run(
    `INSERT INTO users (username, name, role, password_hash, password_salt, iterations)
     VALUES (?, ?, 'admin', ?, ?, ?)`,
    username,
    name,
    pw.hash,
    pw.salt,
    pw.iterations
  );
  return withSession(NextResponse.json({ ok: true }), Number(res.meta.last_row_id), req);
});
