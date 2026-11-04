import type { Tone } from "./status";
import type { Accent, AnnouncementKind, Defect, Lang, PhotoLook, SlideKey, Template } from "./types";

/** Formas que viajan del servidor a la tele y al panel (sin "server-only"). */

export interface Rates {
  fpy: number | null;
  eff: number | null;
}

export interface WeekPoint extends Rates {
  week: number;
  units: number;
}

export interface DefectRow {
  key: Defect;
  count: number;
}

export interface ScopeStats {
  year: number;
  week: number;
  /** YYYY-MM del mes en curso (el de los trabajos de la última semana). */
  month: string;
  current: Rates & { units: number; jobs: number; inspected: number; passed: number };
  /** Semana anterior con datos, para la flecha "vs. semana pasada". */
  prev: (Rates & { week: number }) | null;
  monthRates: Rates;
  ytd: Rates;
  trend: WeekPoint[];
  defects: DefectRow[];
  defectsTotal: number;
}

export interface RankRow {
  code: string;
  name: string;
  value: number;
  tone: Tone;
}

export interface JobRow {
  job: string;
  part: string;
  units: number;
  passed: number;
  inspected: number;
  fpy: number | null;
  eff: number | null;
}

export interface TeamInfo {
  id: number;
  code: string;
  name: string;
  leader: string;
}

export interface Goals {
  goalFpy: number;
  goalEff: number;
  warnFpy: number;
  warnEff: number;
}

export interface FeedAnnouncement {
  id: number;
  kind: AnnouncementKind;
  title: string;
  body: string;
  mediaId: number | null;
  /** Ajustes de la foto del anuncio (si tiene). */
  look: PhotoLook | null;
  teamName: string | null;
  template: Template;
  accent: Accent;
  seconds: number | null;
}

export interface FeedPhoto extends PhotoLook {
  id: number;
  caption: string;
  teamName: string | null;
  seconds: number | null;
}

export interface Feed {
  kind: "plant" | "team";
  lang: Lang;
  displayName: string;
  slideSeconds: number;
  plantName: string;
  goals: Goals;
  safety: { days: number | null; record: number };
  plant: ScopeStats | null;
  rankings: { quality: RankRow[]; efficiency: RankRow[] } | null;
  team: TeamInfo | null;
  teamStats: ScopeStats | null;
  teamJobs: JobRow[];
  teamRank: { quality: number | null; efficiency: number | null; of: number } | null;
  /** Una o dos frases en lenguaje sencillo (Claude o reglas). */
  insight: string | null;
  plantInsight: string | null;
  announcements: FeedAnnouncement[];
  photos: FeedPhoto[];
  /** Láminas que esta pantalla no muestra. */
  hidden: SlideKey[];
  generatedAt: string;
}
