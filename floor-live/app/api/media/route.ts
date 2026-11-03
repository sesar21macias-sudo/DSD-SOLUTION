import { NextResponse } from "next/server";
import { run } from "@/lib/db";
import { bad, handler, localDateTimeOrNull, text } from "@/lib/http";
import { MAX_PHOTO_BYTES, putPhoto, sniffImage } from "@/lib/media";
import { requireEditor, requireScope } from "@/lib/session";

/** Sube una foto (ya reducida en el navegador). multipart: file, team_id, caption, width, height. */
export const POST = handler(async (req: Request) => {
  // Sesión primero: sin ella, ni se lee el archivo.
  await requireEditor();
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_PHOTO_BYTES + 64_000) bad("photoTooBig");
  const form = await req.formData().catch(() => bad("photoType"));
  const rawTeam = form.get("team_id");
  const parsed = rawTeam && rawTeam !== "" ? Number(rawTeam) : null;
  const teamId = parsed !== null && Number.isInteger(parsed) ? parsed : null;
  const me = await requireScope(teamId);

  const file = form.get("file");
  if (!(file instanceof File)) bad("photoType");
  if (file.size > MAX_PHOTO_BYTES) bad("photoTooBig");
  const data = await file.arrayBuffer();
  const type = sniffImage(new Uint8Array(data.slice(0, 16)));
  if (!type) bad("photoType");

  const dim = (k: string) => {
    const n = Number(form.get(k));
    return Number.isInteger(n) && n > 0 && n < 20_000 ? n : null;
  };
  // Programación opcional desde la subida (la misma para todas las fotos de esa tanda).
  const startsAt = localDateTimeOrNull(form.get("starts_at"));
  const endsAt = localDateTimeOrNull(form.get("ends_at"));
  if (startsAt && endsAt && endsAt <= startsAt) bad("endsBeforeStarts");

  const key = await putPhoto(teamId === null ? "plant" : `team-${teamId}`, data, type);
  const res = await run(
    "INSERT INTO media (team_id, r2_key, content_type, width, height, caption, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    teamId,
    key,
    type,
    dim("width"),
    dim("height"),
    text(form.get("caption"), 140),
    startsAt,
    endsAt,
    me.id
  );
  return NextResponse.json({ ok: true, id: Number(res.meta.last_row_id) });
});
