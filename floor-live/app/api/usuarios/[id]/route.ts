import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { newPasswordFields, tempPassword } from "@/lib/accounts";
import { bad, body, handler, idParam, notFound, oneOf, text } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: editar la cuenta, nueva contraseña temporal, o quitar/devolver el acceso. */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const me = await requireAdmin();
  const id = idParam((await params).id);
  if (!(await first("SELECT id FROM users WHERE id = ?", id))) notFound();
  const b = await body<{ action: string; name: string; role: string; teamId: number | null }>(req);

  if (b.action === "update") {
    const name = text(b.name, 60);
    if (!name) bad("nameRequired");
    const kind = oneOf(b.role, ["admin", "leader", "screen"] as const, "leader");
    // Nadie se quita a sí mismo el permiso de admin (evita quedarse sin administradores).
    if (id === me.id && kind !== "admin") bad("cantDemoteSelf");
    let teamId: number | null = null;
    if (kind === "leader" || (kind === "screen" && b.teamId)) {
      const t = await first<{ id: number }>("SELECT id FROM teams WHERE id = ?", Number(b.teamId));
      if (!t) bad("teamRequired");
      teamId = t.id;
    }
    await run(
      "UPDATE users SET name = ?, role = ?, team_id = ?, display_only = ? WHERE id = ?",
      name,
      kind === "admin" ? "admin" : "leader",
      teamId,
      kind === "screen" ? 1 : 0,
      id
    );
    return NextResponse.json({ ok: true });
  }

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
