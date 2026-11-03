import { NextResponse } from "next/server";
import { run } from "@/lib/db";
import { announcementInput } from "@/lib/announce-input";
import { body, handler } from "@/lib/http";
import { requireScope } from "@/lib/session";

export const POST = handler(async (req: Request) => {
  const b = await body<Record<string, unknown>>(req);
  const raw = b.team_id === null || b.team_id === undefined || b.team_id === "" ? null : Number(b.team_id);
  const teamId = raw !== null && Number.isInteger(raw) ? raw : null;
  const me = await requireScope(teamId);
  const f = await announcementInput(b, teamId, me);
  const res = await run(
    `INSERT INTO announcements (team_id, kind, title_en, body_en, title_es, body_es, media_id, starts_at, ends_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    teamId,
    f.kind,
    f.title_en,
    f.body_en,
    f.title_es,
    f.body_es,
    f.media_id,
    f.starts_at,
    f.ends_at,
    me.id
  );
  return NextResponse.json({ ok: true, id: Number(res.meta.last_row_id) });
});
