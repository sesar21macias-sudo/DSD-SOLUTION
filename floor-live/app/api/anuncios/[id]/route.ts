import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { announcementInput, targetTeam } from "@/lib/announce-input";
import { body, handler, idParam, notFound } from "@/lib/http";
import { requireScope } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const row = await first<{ id: number; team_id: number | null }>("SELECT id, team_id FROM announcements WHERE id = ?", id);
  if (!row) notFound();
  return row;
}

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const id = idParam((await params).id);
  const row = await load(id);
  // Un líder no puede moverlo de su equipo; el admin sí puede cambiarlo de pantalla.
  const me = await requireScope(row.team_id);
  const b = await body<Record<string, unknown>>(req);
  const teamId = await targetTeam(b, me, row.team_id);
  const f = await announcementInput(b, teamId, me);
  await run(
    `UPDATE announcements SET team_id = ?, kind = ?, title_en = ?, body_en = ?, title_es = ?, body_es = ?, media_id = ?, starts_at = ?, ends_at = ?, template = ?, accent = ?, seconds = ?
      WHERE id = ?`,
    teamId,
    f.kind,
    f.title_en,
    f.body_en,
    f.title_es,
    f.body_es,
    f.media_id,
    f.starts_at,
    f.ends_at,
    f.template,
    f.accent,
    f.seconds,
    id
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const id = idParam((await params).id);
  const row = await load(id);
  await requireScope(row.team_id);
  await run("DELETE FROM announcements WHERE id = ?", id);
  return NextResponse.json({ ok: true });
});
