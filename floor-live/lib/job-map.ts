import { DEFECTS, type Defect, type JobInput } from "./types";

/**
 * Convierte la hoja "Job Data" (la misma que alimenta Power BI) en trabajos.
 * Las columnas se buscan por nombre, no por posición: si alguien agrega o
 * mueve columnas en el Excel, la subida sigue funcionando.
 */

type Cell = string | number | null;

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMNS: Record<string, string[]> = {
  week: ["week", "wk", "semana"],
  job: ["job", "jobid", "jobnumber", "trabajo"],
  team: ["team", "equipo"],
  part: ["part", "partid", "parte"],
  units: ["units", "qty", "quantity", "piezas"],
  inspected: ["inspected", "inspeccionadas"],
  rejected: ["rejection", "rejected", "rejects", "rechazadas"],
  passed: ["pass", "passed", "pasaron"],
  est_hours: ["esthours", "estimatedhours", "esthrs"],
  act_hours: ["acthours", "actualhours", "acthrs"],
  rework_hours: ["rework"],
  majors: ["majors", "major"],
  stitching: ["stitching"],
  seams: ["seams"],
  binding: ["binding"],
  webbing: ["webbing"],
  labeling: ["labeling", "labelling"],
  hardware: ["hardware"],
  construction: ["const", "construction"],
  fabric: ["fabric"],
};

export const REQUIRED = ["week", "job", "team", "inspected", "passed", "est_hours", "act_hours"] as const;

export interface Parsed {
  jobs: JobInput[];
  skipped: number;
  missing: string[];
  year: number;
  teams: string[];
  weeks: [number, number];
}

function toNum(v: Cell): number {
  if (v === null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Fecha de Excel (número de serie) o texto → YYYY-MM-DD. */
function toDate(v: Cell): string | null {
  if (v === null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function mapJobs(rows: Cell[][]): Parsed {
  // El encabezado es el primer renglón que trae "job" y "team".
  const headerIdx = rows.findIndex((r) => {
    const names = r.map(norm);
    return names.includes("job") && names.includes("team");
  });
  const header = (headerIdx >= 0 ? rows[headerIdx] : rows[0] ?? []).map(norm);

  const col: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(COLUMNS)) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i >= 0) col[key] = i;
  }
  const closedIdx = header.findIndex((h) => h.includes("closed"));
  const missing = REQUIRED.filter((k) => col[k] === undefined);
  if (missing.length) return { jobs: [], skipped: 0, missing: [...missing], year: new Date().getFullYear(), teams: [], weeks: [0, 0] };

  // Un trabajo cerrado, reabierto y vuelto a cerrar sale dos veces con las mismas
  // cifras: se queda solo el último cierre para no contarlo doble.
  const byJob = new Map<string, JobInput>();
  let skipped = 0;
  const years = new Map<number, number>();

  for (const r of rows.slice(headerIdx + 1)) {
    const at = (k: string) => (col[k] === undefined ? null : r[col[k]] ?? null);
    const job = String(at("job") ?? "").trim();
    const team = String(at("team") ?? "").trim().toUpperCase();
    const week = Math.round(toNum(at("week")));
    if (!job || !team || week < 1 || week > 53) {
      skipped++;
      continue;
    }
    if (byJob.has(job)) skipped++;
    const closed = closedIdx >= 0 ? toDate(r[closedIdx] ?? null) : null;
    if (closed) {
      const y = Number(closed.slice(0, 4));
      years.set(y, (years.get(y) ?? 0) + 1);
    }
    const inspected = Math.max(0, Math.round(toNum(at("inspected"))));
    const defects = Object.fromEntries(DEFECTS.map((dk) => [dk, Math.max(0, Math.round(toNum(at(dk))))])) as Record<Defect, number>;
    byJob.set(job, {
      week,
      job: job.slice(0, 40),
      team: team.slice(0, 20),
      part: String(at("part") ?? "").trim().slice(0, 80),
      units: Math.max(0, Math.round(toNum(at("units")))),
      inspected,
      rejected: Math.max(0, Math.round(toNum(at("rejected")))),
      passed: Math.min(inspected, Math.max(0, Math.round(toNum(at("passed"))))),
      est_hours: Math.max(0, toNum(at("est_hours"))),
      act_hours: Math.max(0, toNum(at("act_hours"))),
      rework_hours: Math.max(0, toNum(at("rework_hours"))),
      defects,
      closed_on: closed,
    });
  }

  const jobs = [...byJob.values()];
  const year = [...years.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? new Date().getFullYear();
  const weeks = jobs.map((j) => j.week);
  return {
    jobs,
    skipped,
    missing: [],
    year,
    teams: [...new Set(jobs.map((j) => j.team))].sort(),
    weeks: weeks.length ? [Math.min(...weeks), Math.max(...weeks)] : [0, 0],
  };
}
