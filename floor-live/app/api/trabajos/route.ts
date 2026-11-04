import { NextResponse } from "next/server";
import { all, first, run } from "@/lib/db";
import { bad, body, handler } from "@/lib/http";
import { JOB_COLUMNS, invalidateInsights, jobFromBody, jobValues, logEdit, type JobRecord } from "@/lib/jobs-admin";
import { requireAdmin } from "@/lib/session";

/** Buscar trabajos: ?year=&week=&team=&q= (número de trabajo o parte). Máx. 300. */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const latest = await first<{ y: number | null }>("SELECT MAX(year) AS y FROM jobs");
  const year = Number(sp.get("year")) || latest?.y || new Date().getFullYear();
  const where: string[] = ["year = ?"];
  const params: unknown[] = [year];
  const week = Number(sp.get("week"));
  if (Number.isInteger(week) && week > 0) {
    where.push("week = ?");
    params.push(week);
  }
  const team = (sp.get("team") ?? "").trim().toUpperCase().slice(0, 20);
  if (team) {
    where.push("team_code = ?");
    params.push(team);
  }
  const q = (sp.get("q") ?? "").trim().slice(0, 40);
  if (q) {
    where.push("(job LIKE ? OR part LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const rows = await all<JobRecord>(
    `SELECT * FROM jobs WHERE ${where.join(" AND ")} ORDER BY week DESC, team_code, job LIMIT 300`,
    ...params
  );
  const weeks = await all<{ week: number }>("SELECT DISTINCT week FROM jobs WHERE year = ? ORDER BY week DESC", year);
  const log = await all<{ id: number; job: string; action: string; summary: string; created_at: string; who: string | null }>(
    `SELECT e.id, e.job, e.action, e.summary, e.created_at, u.name AS who
       FROM job_edits e LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC LIMIT 15`
  );
  return NextResponse.json({ year, rows, weeks: weeks.map((w) => w.week), log });
});

/** Agregar un trabajo a mano (uno que todavía no sale en el Excel). */
export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const b = await body<Record<string, unknown>>(req);
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 2015 || year > 2100) bad("yearInvalid");
  const j = await jobFromBody(b);
  if (await first("SELECT id FROM jobs WHERE year = ? AND job = ?", year, j.job)) bad("jobExists");
  const res = await run(
    `INSERT INTO jobs (year, job, ${JOB_COLUMNS.join(", ")}) VALUES (?, ?, ${JOB_COLUMNS.map(() => "?").join(", ")})`,
    year,
    j.job,
    ...jobValues(j)
  );
  await logEdit(year, j.job, "create", `week ${j.week}, ${j.team}, ${j.passed}/${j.inspected}`, me.id);
  await invalidateInsights(year, [j.week]);
  return NextResponse.json({ ok: true, id: Number(res.meta.last_row_id) });
});
