import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { bad, body, handler, idParam, notFound } from "@/lib/http";
import { JOB_COLUMNS, diffSummary, invalidateInsights, jobFromBody, jobValues, logEdit, type JobRecord } from "@/lib/jobs-admin";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number): Promise<JobRecord> {
  const row = await first<JobRecord>("SELECT * FROM jobs WHERE id = ?", id);
  if (!row) notFound();
  return row;
}

/** Corregir un trabajo. El número de trabajo puede cambiar si no choca con otro del mismo año. */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const me = await requireAdmin();
  const row = await load(idParam((await params).id));
  const j = await jobFromBody(await body<Record<string, unknown>>(req));
  if (j.job !== row.job && (await first("SELECT id FROM jobs WHERE year = ? AND job = ?", row.year, j.job))) bad("jobExists");
  await run(
    `UPDATE jobs SET job = ?, ${JOB_COLUMNS.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    j.job,
    ...jobValues(j),
    row.id
  );
  const summary = (j.job !== row.job ? `job ${row.job}→${j.job}, ` : "") + diffSummary(row, j);
  await logEdit(row.year, j.job, "update", summary, me.id);
  await invalidateInsights(row.year, [row.week, j.week]);
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const me = await requireAdmin();
  const row = await load(idParam((await params).id));
  await run("DELETE FROM jobs WHERE id = ?", row.id);
  await logEdit(row.year, row.job, "delete", `week ${row.week}, ${row.team_code}, ${row.passed}/${row.inspected}`, me.id);
  await invalidateInsights(row.year, [row.week]);
  return NextResponse.json({ ok: true });
});
