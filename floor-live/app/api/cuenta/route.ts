import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { hashPassword, safeEqual, validatePassword } from "@/lib/auth";
import { newPasswordFields } from "@/lib/accounts";
import { bad, body, handler } from "@/lib/http";
import { requireUser } from "@/lib/session";
import type { UserRow } from "@/lib/types";

/** Cambiar la contraseña propia (por ejemplo, la temporal que dio el admin). */
export const PATCH = handler(async (req: Request) => {
  const me = await requireUser();
  const b = await body<{ current: string; next: string }>(req);
  const row = await first<UserRow>("SELECT * FROM users WHERE id = ?", me.id);
  if (!row) bad("accountMissing");

  const hash = await hashPassword(String(b.current ?? ""), row.password_salt, row.iterations);
  if (!safeEqual(hash, row.password_hash)) bad("wrongPassword");

  const next = String(b.next ?? "");
  const err = validatePassword(next);
  if (err) bad(err);

  const pw = await newPasswordFields(next);
  await run(
    "UPDATE users SET password_hash = ?, password_salt = ?, iterations = ? WHERE id = ?",
    pw.hash,
    pw.salt,
    pw.iterations,
    me.id
  );
  return NextResponse.json({ ok: true });
});
