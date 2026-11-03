export type Role = "admin" | "leader";
export type Lang = "es" | "en";

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  team_id: number | null;
  active: number;
  /** 1 = cuenta de pantalla: solo muestra /vista, no cambia nada. */
  display_only: number;
}

export interface UserRow extends User {
  password_hash: string;
  password_salt: string;
  iterations: number;
}

export interface Team {
  id: number;
  code: string;
  name: string;
  leader: string;
  active: number;
  position: number;
}

export type AnnouncementKind = "news" | "celebration" | "safety" | "reminder";
export const ANNOUNCEMENT_KINDS: AnnouncementKind[] = ["news", "celebration", "safety", "reminder"];

export interface Announcement {
  id: number;
  team_id: number | null;
  kind: AnnouncementKind;
  title_en: string;
  body_en: string;
  title_es: string;
  body_es: string;
  media_id: number | null;
  /** Hora local de planta "YYYY-MM-DDTHH:MM"; null = sin límite. */
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface Media {
  id: number;
  team_id: number | null;
  width: number | null;
  height: number | null;
  caption: string;
  in_rotation: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface Display {
  id: number;
  name: string;
  status: "pending" | "active";
  scope: "plant" | "team";
  team_id: number | null;
  lang: Lang;
  slide_seconds: number;
  last_seen: string | null;
  created_at: string;
}

/** Categorías de defecto, en el orden de las columnas del Excel. */
export const DEFECTS = [
  "majors",
  "stitching",
  "seams",
  "binding",
  "webbing",
  "labeling",
  "hardware",
  "construction",
  "fabric",
] as const;
export type Defect = (typeof DEFECTS)[number];

/** Lo que se sube por cada renglón del Excel (ya leído en el navegador). */
export interface JobInput {
  week: number;
  job: string;
  team: string;
  part: string;
  units: number;
  inspected: number;
  rejected: number;
  passed: number;
  est_hours: number;
  act_hours: number;
  rework_hours: number;
  defects: Record<Defect, number>;
  closed_on: string | null;
}

export interface Settings {
  plantName: string;
  goalFpy: number;
  goalEff: number;
  /** Puntos por debajo de la meta que todavía cuentan como "cerca" (ámbar). */
  warnFpy: number;
  warnEff: number;
  /** Fecha (YYYY-MM-DD) del último accidente con tiempo perdido. */
  safetySince: string | null;
  /** Récord de días sin accidente, para la meta a vencer. */
  safetyRecord: number;
}
