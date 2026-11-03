import "server-only";
import { all, first } from "./db";
import { ratio, toneFor } from "./status";
import type { DefectRow, JobRow, RankRow, Rates, ScopeStats, WeekPoint } from "./feed-types";
import { DEFECTS, type Settings, type Team } from "./types";

/*
 * Todas las cifras salen de sumas, nunca de promediar porcentajes:
 *   FPY (calidad)     = piezas que pasaron a la primera / piezas inspeccionadas
 *   Eficiencia        = horas estimadas / horas reales  (más de 100% = más rápido que el estándar)
 * Así un trabajo de 5 piezas no pesa lo mismo que uno de 300.
 */

interface Sums {
  inspected: number;
  passed: number;
  est: number;
  act: number;
  units: number;
  jobs: number;
}

const zero = (): Sums => ({ inspected: 0, passed: 0, est: 0, act: 0, units: 0, jobs: 0 });

function add(a: Sums, b: Sums): Sums {
  return {
    inspected: a.inspected + b.inspected,
    passed: a.passed + b.passed,
    est: a.est + b.est,
    act: a.act + b.act,
    units: a.units + b.units,
    jobs: a.jobs + b.jobs,
  };
}

function rates(s: Sums): Rates {
  return { fpy: ratio(s.passed, s.inspected), eff: ratio(s.est, s.act) };
}

const DEFECT_SUMS = DEFECTS.map((d) => `SUM(d_${d}) AS ${d}`).join(", ");

export interface YearData {
  year: number;
  week: number;
  month: string;
  /** team_code → semana → sumas */
  byTeam: Map<string, Map<number, Sums>>;
  monthByTeam: Map<string, Sums>;
  defectsByTeam: Map<string, Record<string, number>>;
}

/** El año y la semana más recientes con datos, o null si todavía no se ha subido nada. */
export async function latestWeek(): Promise<{ year: number; week: number } | null> {
  const row = await first<{ year: number; week: number }>(
    "SELECT year, MAX(week) AS week FROM jobs WHERE year = (SELECT MAX(year) FROM jobs)"
  );
  return row && row.year ? row : null;
}

export async function loadYear(): Promise<YearData | null> {
  const latest = await latestWeek();
  if (!latest) return null;
  const { year, week } = latest;

  const monthRow = await first<{ m: string | null }>(
    "SELECT substr(MAX(closed_on), 1, 7) AS m FROM jobs WHERE year = ? AND week = ?",
    year,
    week
  );
  const month = monthRow?.m ?? "";

  const weekly = await all<{ team_code: string; week: number } & Sums>(
    `SELECT team_code, week, SUM(inspected) AS inspected, SUM(passed) AS passed,
            SUM(est_hours) AS est, SUM(act_hours) AS act, SUM(units) AS units, COUNT(*) AS jobs
       FROM jobs WHERE year = ? GROUP BY team_code, week`,
    year
  );
  const byTeam = new Map<string, Map<number, Sums>>();
  for (const r of weekly) {
    if (!byTeam.has(r.team_code)) byTeam.set(r.team_code, new Map());
    byTeam.get(r.team_code)!.set(r.week, {
      inspected: r.inspected,
      passed: r.passed,
      est: r.est,
      act: r.act,
      units: r.units,
      jobs: r.jobs,
    });
  }

  const monthByTeam = new Map<string, Sums>();
  const defectsByTeam = new Map<string, Record<string, number>>();
  if (month) {
    const monthly = await all<{ team_code: string } & Sums & Record<string, number>>(
      `SELECT team_code, SUM(inspected) AS inspected, SUM(passed) AS passed,
              SUM(est_hours) AS est, SUM(act_hours) AS act, SUM(units) AS units, COUNT(*) AS jobs,
              ${DEFECT_SUMS}
         FROM jobs WHERE year = ? AND substr(closed_on, 1, 7) = ? GROUP BY team_code`,
      year,
      month
    );
    for (const r of monthly) {
      monthByTeam.set(r.team_code, {
        inspected: r.inspected,
        passed: r.passed,
        est: r.est,
        act: r.act,
        units: r.units,
        jobs: r.jobs,
      });
      defectsByTeam.set(r.team_code, Object.fromEntries(DEFECTS.map((d) => [d, Number(r[d]) || 0])));
    }
  }

  return { year, week, month, byTeam, monthByTeam, defectsByTeam };
}

/** Estadísticas de un conjunto de equipos (uno solo, o todos para la planta). */
export function statsFor(data: YearData, codes: string[] | "all"): ScopeStats | null {
  const teams = codes === "all" ? [...data.byTeam.keys()] : codes;

  const perWeek = new Map<number, Sums>();
  let ytd = zero();
  let month = zero();
  const defects: Record<string, number> = {};

  for (const code of teams) {
    const weeks = data.byTeam.get(code);
    if (weeks) {
      for (const [w, s] of weeks) {
        perWeek.set(w, add(perWeek.get(w) ?? zero(), s));
        ytd = add(ytd, s);
      }
    }
    const m = data.monthByTeam.get(code);
    if (m) month = add(month, m);
    const d = data.defectsByTeam.get(code);
    if (d) for (const k of DEFECTS) defects[k] = (defects[k] ?? 0) + (d[k] ?? 0);
  }

  if (perWeek.size === 0) return null;

  const current = perWeek.get(data.week) ?? zero();
  const earlier = [...perWeek.keys()].filter((w) => w < data.week).sort((a, b) => b - a);
  const prevWeek = earlier[0];

  const trendWeeks = [...perWeek.keys()].filter((w) => w <= data.week).sort((a, b) => a - b).slice(-8);
  const trend: WeekPoint[] = trendWeeks.map((w) => {
    const s = perWeek.get(w)!;
    return { week: w, units: s.units, ...rates(s) };
  });

  // "MAJORS" ya es la suma de los mayores; los demás son categorías. Mostramos categorías.
  const defectRows: DefectRow[] = DEFECTS.filter((k) => k !== "majors")
    .map((key) => ({ key, count: defects[key] ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    year: data.year,
    week: data.week,
    month: data.month,
    current: { ...rates(current), units: current.units, jobs: current.jobs, inspected: current.inspected, passed: current.passed },
    prev: prevWeek === undefined ? null : { week: prevWeek, ...rates(perWeek.get(prevWeek)!) },
    monthRates: rates(month),
    ytd: rates(ytd),
    trend,
    defects: defectRows,
    defectsTotal: defectRows.reduce((n, r) => n + r.count, 0),
  };
}

/** Ranking de la semana: solo equipos activos que cerraron trabajos esa semana. */
export function rankings(data: YearData, teams: Team[], s: Settings): { quality: RankRow[]; efficiency: RankRow[] } {
  const rows = teams
    .filter((t) => t.active)
    .map((t) => {
      const sums = data.byTeam.get(t.code)?.get(data.week);
      return sums && sums.inspected > 0 ? { t, r: rates(sums) } : null;
    })
    .filter((x): x is { t: Team; r: Rates } => x !== null);

  const quality = rows
    .filter((x) => x.r.fpy !== null)
    .map((x) => ({ code: x.t.code, name: x.t.name, value: x.r.fpy!, tone: toneFor(x.r.fpy! * 100, s.goalFpy, s.warnFpy) }))
    .sort((a, b) => b.value - a.value);
  const efficiency = rows
    .filter((x) => x.r.eff !== null)
    .map((x) => ({ code: x.t.code, name: x.t.name, value: x.r.eff!, tone: toneFor(x.r.eff! * 100, s.goalEff, s.warnEff) }))
    .sort((a, b) => b.value - a.value);
  return { quality, efficiency };
}

/** Trabajos que el equipo cerró en la semana, los más grandes primero. */
export async function teamJobs(year: number, week: number, code: string): Promise<JobRow[]> {
  const rows = await all<{
    job: string;
    part: string;
    units: number;
    passed: number;
    inspected: number;
    est_hours: number;
    act_hours: number;
  }>(
    `SELECT job, part, units, passed, inspected, est_hours, act_hours
       FROM jobs WHERE year = ? AND week = ? AND team_code = ?
      ORDER BY units DESC, job LIMIT 8`,
    year,
    week,
    code
  );
  return rows.map((r) => ({
    job: r.job,
    part: r.part,
    units: r.units,
    passed: r.passed,
    inspected: r.inspected,
    fpy: ratio(r.passed, r.inspected),
    eff: ratio(r.est_hours, r.act_hours),
  }));
}
