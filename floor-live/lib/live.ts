import "server-only";
import { all } from "./db";
import { nowInTz } from "./dates";

/** Lo que una pantalla está mostrando ahorita además de las métricas (mismas reglas que la tele). */
export interface LiveItem {
  type: "news" | "photo";
  id: number;
  label: string;
  ends_at: string | null;
  seconds: number | null;
}

export async function liveContent(teamId: number | null): Promise<LiveItem[]> {
  const now = nowInTz();
  const scope = teamId === null ? "team_id IS NULL" : "(team_id IS NULL OR team_id = ?)";
  const params = teamId === null ? [now, now] : [now, now, teamId];
  const news = await all<{ id: number; title_es: string; title_en: string; body_es: string; body_en: string; ends_at: string | null; seconds: number | null }>(
    `SELECT id, title_es, title_en, body_es, body_en, ends_at, seconds FROM announcements
      WHERE (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?) AND ${scope}
      ORDER BY created_at DESC LIMIT 12`,
    ...params
  );
  const photos = await all<{ id: number; caption: string; ends_at: string | null; seconds: number | null }>(
    `SELECT id, caption, ends_at, seconds FROM media
      WHERE in_rotation = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?) AND ${scope}
      ORDER BY created_at DESC LIMIT 12`,
    ...params
  );
  return [
    ...news.map((n) => ({
      type: "news" as const,
      id: n.id,
      label: n.title_es || n.title_en || n.body_es || n.body_en,
      ends_at: n.ends_at,
      seconds: n.seconds,
    })),
    ...photos.map((p) => ({ type: "photo" as const, id: p.id, label: p.caption, ends_at: p.ends_at, seconds: p.seconds })),
  ];
}
