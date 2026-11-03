import "server-only";
import { all, first } from "./db";
import { daysSince, nowInTz, todayInTz } from "./dates";
import type { Feed, FeedAnnouncement, FeedPhoto } from "./feed-types";
import { loadYear, rankings, statsFor, teamJobs } from "./metrics";
import { getSettings } from "./settings";
import { ruleSummary } from "./summary";
import type { Announcement, Lang, Team } from "./types";

export interface FeedTarget {
  kind: "plant" | "team";
  teamId: number | null;
  lang: Lang;
  displayName: string;
  slideSeconds: number;
}

/** Todo lo que una pantalla necesita para su rotación, en una sola respuesta. */
export async function buildFeed(t: FeedTarget): Promise<Feed> {
  const [s, data, teams] = await Promise.all([
    getSettings(),
    loadYear(),
    all<Team>("SELECT * FROM teams ORDER BY position, name"),
  ]);
  const team = t.kind === "team" && t.teamId ? teams.find((x) => x.id === t.teamId) ?? null : null;
  const teamName = new Map(teams.map((x) => [x.id, x.name]));

  const plant = data ? statsFor(data, "all") : null;
  const ranks = data ? rankings(data, teams, s) : null;
  const teamStats = data && team ? statsFor(data, [team.code]) : null;
  const jobs = data && team ? await teamJobs(data.year, data.week, team.code) : [];

  let teamRank: Feed["teamRank"] = null;
  if (ranks && team) {
    const q = ranks.quality.findIndex((r) => r.code === team.code);
    const e = ranks.efficiency.findIndex((r) => r.code === team.code);
    teamRank = { quality: q < 0 ? null : q + 1, efficiency: e < 0 ? null : e + 1, of: ranks.quality.length };
  }

  const insightFor = async (scope: string, stats: typeof plant, who: string) => {
    if (!stats || !data) return null;
    const row = await first<{ text: string }>(
      "SELECT text FROM insights WHERE scope = ? AND year = ? AND week = ? AND lang = ?",
      scope,
      data.year,
      data.week,
      t.lang
    );
    return row?.text ?? ruleSummary(stats, s, t.lang, who);
  };
  const plantWho = t.lang === "en" ? "The plant" : "La planta";
  const plantInsight = await insightFor("plant", plant, plantWho);
  const insight = team ? await insightFor(team.code, teamStats, team.name) : plantInsight;

  // Anuncios vigentes AHORA (fecha y hora de planta): los de planta siempre; los del
  // equipo solo en su pantalla. La tele pregunta cada minuto, así que entran y salen a tiempo.
  const today = todayInTz();
  const now = nowInTz();
  const rows = await all<Announcement>(
    `SELECT * FROM announcements
      WHERE (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)
        AND (team_id IS NULL ${team ? "OR team_id = ?" : ""})
      ORDER BY created_at DESC LIMIT 12`,
    ...(team ? [now, now, team.id] : [now, now])
  );
  const other: Lang = t.lang === "en" ? "es" : "en";
  const announcements: FeedAnnouncement[] = rows
    .map((a) => {
      const title = a[`title_${t.lang}`] || a[`title_${other}`];
      const body = a[`body_${t.lang}`] || a[`body_${other}`];
      return {
        id: a.id,
        kind: a.kind,
        title,
        body,
        mediaId: a.media_id,
        teamName: a.team_id ? teamName.get(a.team_id) ?? null : null,
      };
    })
    .filter((a) => a.title || a.body);

  const photoRows = await all<{ id: number; caption: string; team_id: number | null }>(
    `SELECT id, caption, team_id FROM media
      WHERE in_rotation = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)
        AND (team_id IS NULL ${team ? "OR team_id = ?" : ""})
      ORDER BY created_at DESC LIMIT 12`,
    ...(team ? [now, now, team.id] : [now, now])
  );
  const photos: FeedPhoto[] = photoRows.map((p) => ({
    id: p.id,
    caption: p.caption,
    teamName: p.team_id ? teamName.get(p.team_id) ?? null : null,
  }));

  return {
    kind: team ? "team" : "plant",
    lang: t.lang,
    displayName: t.displayName,
    slideSeconds: t.slideSeconds,
    plantName: s.plantName,
    goals: { goalFpy: s.goalFpy, goalEff: s.goalEff, warnFpy: s.warnFpy, warnEff: s.warnEff },
    safety: { days: s.safetySince ? daysSince(s.safetySince, today) : null, record: s.safetyRecord },
    plant,
    rankings: ranks,
    team: team ? { id: team.id, code: team.code, name: team.name, leader: team.leader } : null,
    teamStats,
    teamJobs: jobs,
    teamRank,
    insight,
    plantInsight,
    announcements,
    photos,
    generatedAt: new Date().toISOString(),
  };
}
