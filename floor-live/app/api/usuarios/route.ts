import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { normalizeUsername, validateUsername } from "@/lib/auth";
import { newPasswordFields, tempPassword } from "@/lib/accounts";
import { bad, body, handler, oneOf, text } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

/** Alta de un acceso. La contraseña temporal se devuelve una sola vez y no se guarda en claro. */
export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const b = await body<{ name: string; username: string; role: string; teamId: number }>(req);
  const name = text(b.name, 60);
  if (!name) bad("nameRequired");
  const username = normalizeUsername(String(b.username ?? ""));
  const uErr = validateUsername(username);
  if (uErr) bad(uErr);
  // "screen" = cuenta de pantalla: solo muestra la planta (sin equipo) o un equipo.
  const kind = oneOf(b.role, ["admin", "leader", "screen"] as const, "leader");
  const role = kind === "admin" ? "admin" : "leader";
  let teamId: number | null = null;
  if (kind === "leader" || (kind === "screen" && b.teamId)) {
    const t = await first<{ id: number }>("SELECT id FROM teams WHERE id = ?", Number(b.teamId));
    if (!t) bad("teamRequired");
    teamId = t.id;
  }
  if (await first("SELECT id FROM users WHERE username = ?", username)) bad("usernameTaken");

  const password = tempPassword();
  const pw = await newPasswordFields(password);
  await run(
    "INSERT INTO users (username, name, role, team_id, display_only, password_hash, password_salt, iterations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    username,
    name,
    role,
    teamId,
    kind === "screen" ? 1 : 0,
    pw.hash,
    pw.salt,
    pw.iterations
  );
  return NextResponse.json({ ok: true, password });
});
