import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { normalizeCode } from "@/lib/displays";
import { bad, body, handler, intOrNull, oneOf, text } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

/** El admin reclama una tele por su código y le dice qué mostrar. */
export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const b = await body<{ code: string; name: string; scope: string; teamId: number; lang: string; seconds: number }>(req);
  const code = normalizeCode(b.code);
  if (code.length !== 6) bad("codeInvalid");

  const row = await first<{ id: number; pair_expires: string | null }>(
    "SELECT id, pair_expires FROM displays WHERE pair_code = ? AND status = 'pending'",
    code
  );
  if (!row || !row.pair_expires || Date.parse(row.pair_expires) < Date.now()) bad("codeInvalid");

  const scope = oneOf(b.scope, ["plant", "team"] as const, "plant");
  let teamId: number | null = null;
  if (scope === "team") {
    const t = await first<{ id: number }>("SELECT id FROM teams WHERE id = ?", Number(b.teamId));
    if (!t) bad("teamRequired");
    teamId = t.id;
  }
  await run(
    `UPDATE displays SET status = 'active', name = ?, scope = ?, team_id = ?, lang = ?, slide_seconds = ?,
            pair_code = NULL, pair_expires = NULL
      WHERE id = ?`,
    text(b.name, 40),
    scope,
    teamId,
    oneOf(b.lang, ["en", "es"] as const, "en"),
    intOrNull(b.seconds, 6, 120) ?? 15,
    row.id
  );
  return NextResponse.json({ ok: true, id: row.id });
});
