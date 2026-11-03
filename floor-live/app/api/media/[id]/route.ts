import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { TV_COOKIE, displayBySecret } from "@/lib/displays";
import { getEnv } from "@/lib/env";
import { bad, body, handler, idParam, localDateTimeOrNull, notFound, text } from "@/lib/http";
import { deletePhoto } from "@/lib/media";
import { HttpError, canView, getCurrentUser, requireScope } from "@/lib/session";
import { targetTeam } from "@/lib/announce-input";

type Ctx = { params: Promise<{ id: string }> };

interface Row {
  id: number;
  team_id: number | null;
  r2_key: string;
  content_type: string;
}

async function load(id: number): Promise<Row> {
  const row = await first<Row>("SELECT id, team_id, r2_key, content_type FROM media WHERE id = ?", id);
  if (!row) notFound("photoGone");
  return row;
}

/**
 * Las fotos no viven en un bucket público. Las ve quien tiene sesión (de planta
 * o de su equipo; el admin todas), o una tele conectada a la que le corresponden:
 * planta → fotos de planta; equipo → planta + su equipo.
 */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const row = await load(idParam((await params).id));

  let allowed = false;
  const user = await getCurrentUser();
  if (user) allowed = canView(user, row.team_id);
  if (!allowed) {
    const tv = await displayBySecret((await cookies()).get(TV_COOKIE)?.value);
    if (tv?.status === "active") allowed = row.team_id === null || (tv.scope === "team" && tv.team_id === row.team_id);
  }
  if (!allowed) throw new HttpError(404, "photoGone");

  const obj = await (await getEnv()).MEDIA.get(row.r2_key);
  if (!obj) notFound("photoGone");
  return new Response(obj.body as ReadableStream, {
    headers: {
      "Content-Type": row.content_type,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // La llave nunca cambia de contenido; caché privada (no un CDN compartido).
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const row = await load(idParam((await params).id));
  const me = await requireScope(row.team_id);
  const b = await body<{ caption: string; in_rotation: boolean; starts_at: string | null; ends_at: string | null; team_id?: number | null }>(req);
  const teamId = await targetTeam(b as Record<string, unknown>, me, row.team_id);
  const startsAt = localDateTimeOrNull(b.starts_at);
  const endsAt = localDateTimeOrNull(b.ends_at);
  if (startsAt && endsAt && endsAt <= startsAt) bad("endsBeforeStarts");
  await run(
    "UPDATE media SET team_id = ?, caption = ?, in_rotation = ?, starts_at = ?, ends_at = ? WHERE id = ?",
    teamId,
    text(b.caption, 140),
    b.in_rotation === false ? 0 : 1,
    startsAt,
    endsAt,
    row.id
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const row = await load(idParam((await params).id));
  await requireScope(row.team_id);
  await run("DELETE FROM media WHERE id = ?", row.id);
  await deletePhoto(row.r2_key);
  return NextResponse.json({ ok: true });
});
