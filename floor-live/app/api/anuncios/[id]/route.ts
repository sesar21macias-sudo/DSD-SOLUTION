import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { announcementInput } from "@/lib/announce-input";
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
  // El anuncio se queda en su equipo: un líder no puede moverlo a la planta.
  const me = await requireScope(row.team_id);
  const f = await announcementInput(await body<Record<string, unknown>>(req), row.team_id, me);
  await run(
    `UPDATE announcements SET kind = ?, title_en = ?, body_en = ?, title_es = ?, body_es = ?, media_id = ?, starts_at = ?, ends_at = ?
      WHERE id = ?`,
    f.kind,
    f.title_en,
    f.body_en,
    f.title_es,
    f.body_es,
    f.media_id,
    f.starts_at,
    f.ends_at,
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
