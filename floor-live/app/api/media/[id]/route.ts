import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { TV_COOKIE, displayBySecret } from "@/lib/displays";
import { getEnv } from "@/lib/env";
import { bad, body, handler, idParam, intOrNull, localDateTimeOrNull, notFound, oneOf, text } from "@/lib/http";
import { PHOTO_BGS } from "@/lib/types";
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

/**
 * Editar una foto. Los campos que no vengan se quedan como estaban, así un cambio
 * pequeño (el pie de foto, por ejemplo) nunca borra los ajustes de cómo se ve.
 */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const row = await load(idParam((await params).id));
  const me = await requireScope(row.team_id);
  const b = await body<Record<string, unknown>>(req);
  const cur = await first<{
    caption: string;
    in_rotation: number;
    starts_at: string | null;
    ends_at: string | null;
    fit: string;
    pos_x: number;
    pos_y: number;
    bg: string;
    motion: number;
    seconds: number | null;
  }>("SELECT caption, in_rotation, starts_at, ends_at, fit, pos_x, pos_y, bg, motion, seconds FROM media WHERE id = ?", row.id);
  if (!cur) notFound("photoGone");
  const has = (k: string) => k in b;

  const teamId = await targetTeam(b, me, row.team_id);
  const startsAt = has("starts_at") ? localDateTimeOrNull(b.starts_at) : cur.starts_at;
  const endsAt = has("ends_at") ? localDateTimeOrNull(b.ends_at) : cur.ends_at;
  if (startsAt && endsAt && endsAt <= startsAt) bad("endsBeforeStarts");
  const pct = (k: "pos_x" | "pos_y") => (has(k) ? intOrNull(b[k], 0, 100) ?? 50 : cur[k]);

  await run(
    `UPDATE media SET team_id = ?, caption = ?, in_rotation = ?, starts_at = ?, ends_at = ?,
            fit = ?, pos_x = ?, pos_y = ?, bg = ?, motion = ?, seconds = ?
      WHERE id = ?`,
    teamId,
    has("caption") ? text(b.caption, 140) : cur.caption,
    has("in_rotation") ? (b.in_rotation === false ? 0 : 1) : cur.in_rotation,
    startsAt,
    endsAt,
    has("fit") ? oneOf(b.fit, ["cover", "contain"] as const, "cover") : cur.fit,
    pct("pos_x"),
    pct("pos_y"),
    has("bg") ? oneOf(b.bg, PHOTO_BGS, "black") : cur.bg,
    has("motion") ? (b.motion === false || b.motion === 0 ? 0 : 1) : cur.motion,
    has("seconds") ? intOrNull(b.seconds, 5, 300) : cur.seconds,
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
