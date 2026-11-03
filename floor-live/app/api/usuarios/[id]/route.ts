import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { newPasswordFields, tempPassword } from "@/lib/accounts";
import { bad, body, handler, idParam, notFound } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: nueva contraseña temporal, o quitar/devolver el acceso. */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const me = await requireAdmin();
  const id = idParam((await params).id);
  if (!(await first("SELECT id FROM users WHERE id = ?", id))) notFound();
  const b = await body<{ action: string }>(req);

  if (b.action === "reset") {
    const password = tempPassword();
    const pw = await newPasswordFields(password);
    await run("UPDATE users SET password_hash = ?, password_salt = ?, iterations = ? WHERE id = ?", pw.hash, pw.salt, pw.iterations, id);
    return NextResponse.json({ ok: true, password });
  }
  if (b.action === "deactivate" || b.action === "activate") {
    if (id === me.id) bad("cantDemoteSelf");
    await run("UPDATE users SET active = ? WHERE id = ?", b.action === "activate" ? 1 : 0, id);
    return NextResponse.json({ ok: true });
  }
  notFound();
});
