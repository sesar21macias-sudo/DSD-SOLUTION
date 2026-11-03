import "server-only";
import { first } from "./db";
import { bad, localDateTimeOrNull, oneOf, text } from "./http";
import { ANNOUNCEMENT_KINDS, type User } from "./types";

/** Valida el cuerpo de un anuncio (alta o edición). El equipo se decide afuera, con permisos. */
export async function announcementInput(b: Record<string, unknown>, teamId: number | null, me: User) {
  const fields = {
    kind: oneOf(b.kind, ANNOUNCEMENT_KINDS, "news"),
    title_en: text(b.title_en, 80),
    body_en: text(b.body_en, 400),
    title_es: text(b.title_es, 80),
    body_es: text(b.body_es, 400),
    starts_at: localDateTimeOrNull(b.starts_at),
    ends_at: localDateTimeOrNull(b.ends_at),
    media_id: null as number | null,
  };
  if (!fields.title_en && !fields.body_en && !fields.title_es && !fields.body_es) bad("textRequired");
  if (fields.starts_at && fields.ends_at && fields.ends_at <= fields.starts_at) bad("endsBeforeStarts");

  // La foto tiene que ser una que esta persona puede ver: de planta o de su mismo equipo.
  const mediaId = Number(b.media_id);
  if (Number.isInteger(mediaId) && mediaId > 0) {
    const m = await first<{ id: number; team_id: number | null }>("SELECT id, team_id FROM media WHERE id = ?", mediaId);
    if (m && (m.team_id === null || m.team_id === teamId || me.role === "admin")) fields.media_id = m.id;
  }
  return fields;
}
