import "server-only";
import { first, run } from "./db";
import { bad } from "./http";
import { cleanJob } from "./job-input";
import { DEFECTS, type JobInput } from "./types";

/** Un trabajo tal como está en la base (para el editor del panel). */
export interface JobRecord {
  id: number;
  year: number;
  week: number;
  job: string;
  team_code: string;
  part: string;
  units: number;
  inspected: number;
  rejected: number;
  passed: number;
  est_hours: number;
  act_hours: number;
  rework_hours: number;
  closed_on: string | null;
  import_id: number | null;
  d_majors: number;
  d_stitching: number;
  d_seams: number;
  d_binding: number;
  d_webbing: number;
  d_labeling: number;
  d_hardware: number;
  d_construction: number;
  d_fabric: number;
}

/** Valida lo que manda el editor; el equipo tiene que existir (se elige de la lista). */
export async function jobFromBody(b: Record<string, unknown>): Promise<JobInput> {
  let job: JobInput;
  try {
    job = cleanJob(b as Partial<JobInput>);
  } catch {
    bad("jobInvalid");
  }
  if (!(await first("SELECT id FROM teams WHERE code = ?", job.team))) bad("teamRequired");
  return job;
}

export const JOB_COLUMNS = [
  "week", "team_code", "part", "units", "inspected", "rejected", "passed",
  "est_hours", "act_hours", "rework_hours", ...DEFECTS.map((d) => `d_${d}`), "closed_on",
] as const;

export function jobValues(j: JobInput): unknown[] {
  return [
    j.week, j.team, j.part, j.units, j.inspected, j.rejected, j.passed,
    j.est_hours, j.act_hours, j.rework_hours, ...DEFECTS.map((d) => j.defects[d]), j.closed_on,
  ];
}

/** "piezas 100→98, pasaron 92→95": lo que cambió, para la bitácora. */
export function diffSummary(before: JobRecord, after: JobInput): string {
  const pairs: [string, unknown, unknown][] = [
    ["week", before.week, after.week],
    ["team", before.team_code, after.team],
    ["part", before.part, after.part],
    ["units", before.units, after.units],
    ["inspected", before.inspected, after.inspected],
    ["passed", before.passed, after.passed],
    ["est_hours", before.est_hours, after.est_hours],
    ["act_hours", before.act_hours, after.act_hours],
    ...DEFECTS.map((d) => [d, before[`d_${d}` as keyof JobRecord], after.defects[d]] as [string, unknown, unknown]),
  ];
  return pairs
    .filter(([, a, b]) => String(a ?? "") !== String(b ?? ""))
    .map(([k, a, b]) => `${k} ${a}→${b}`)
    .join(", ")
    .slice(0, 400);
}

export async function logEdit(year: number, job: string, action: "create" | "update" | "delete", summary: string, userId: number) {
  await run("INSERT INTO job_edits (year, job, action, summary, user_id) VALUES (?, ?, ?, ?, ?)", year, job, action, summary, userId);
}

/** Los resúmenes guardados de esas semanas ya no cuadran: se borran (la tele usa las reglas). */
export async function invalidateInsights(year: number, weeks: number[]) {
  for (const w of new Set(weeks)) await run("DELETE FROM insights WHERE year = ? AND week = ?", year, w);
}
