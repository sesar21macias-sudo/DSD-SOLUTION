import { NextResponse } from "next/server";
import { all, first, getD1, run } from "@/lib/db";
import { bad, handler } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { DEFECTS, type JobInput } from "@/lib/types";

/*
 * Recibe los renglones del Excel ya leídos en el navegador (el archivo nunca
 * sube completo). Aquí se valida cada campo otra vez, porque el navegador no
 * es de fiar, y se guarda con "upsert" por (año, trabajo): volver a subir la
 * misma semana corrige en lugar de duplicar.
 *
 * El navegador manda en tandas de hasta 1000; `importId` agrupa las tandas
 * de una misma subida en un solo renglón del historial.
 */

const MAX_ROWS = 1000;
const MAX_BODY = 2_000_000;

function int(v: unknown, max = 1_000_000): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error("bad");
  return Math.round(n);
}
function num(v: unknown, max = 1_000_000): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error("bad");
  return Math.round(n * 100) / 100;
}
function str(v: unknown, max: number, required = false): string {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  if (required && !s) throw new Error("bad");
  // Sin caracteres de control: estos textos acaban en la tele.
  return s.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

function clean(raw: Partial<JobInput>): JobInput {
  const closed = typeof raw.closed_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.closed_on) ? raw.closed_on : null;
  const inspected = int(raw.inspected);
  const passed = Math.min(int(raw.passed), inspected);
  const defects = Object.fromEntries(
    DEFECTS.map((d) => [d, int((raw.defects as Record<string, unknown> | undefined)?.[d] ?? 0)])
  ) as JobInput["defects"];
  const week = int(raw.week, 53);
  if (week < 1) throw new Error("bad");
  return {
    week,
    job: str(raw.job, 40, true),
    team: str(raw.team, 20, true).toUpperCase(),
    part: str(raw.part, 80),
    units: int(raw.units),
    inspected,
    rejected: int(raw.rejected),
    passed,
    est_hours: num(raw.est_hours),
    act_hours: num(raw.act_hours),
    rework_hours: num(raw.rework_hours),
    defects,
    closed_on: closed,
  };
}

/** Equipos numerados primero (ELP01, ELP02…), luego el resto en orden alfabético. */
function teamOrder(a: string, b: string): number {
  const na = /^ELP0*(\d{1,2})$/.exec(a)?.[1];
  const nb = /^ELP0*(\d{1,2})$/.exec(b)?.[1];
  if (na && nb) return Number(na) - Number(nb);
  if (na) return -1;
  if (nb) return 1;
  return a.localeCompare(b);
}

/** Nombre inicial para un código nuevo: ELP01 → "Team 1"; los demás, tal cual. */
function defaultName(code: string): string {
  const m = /^ELP0*(\d{1,2})$/.exec(code);
  return m ? `Team ${Number(m[1])}` : code;
}

export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) bad("importTooBig");

  const b = (await req.json().catch(() => null)) as {
    filename?: unknown;
    year?: unknown;
    importId?: unknown;
    rows?: unknown;
  } | null;
  if (!b || !Array.isArray(b.rows) || b.rows.length === 0) bad("importEmpty");
  const rawRows = b.rows as Partial<JobInput>[];
  if (rawRows.length > MAX_ROWS) bad("importTooBig");

  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 2015 || year > 2100) bad("yearInvalid");

  const rows: JobInput[] = [];
  rawRows.forEach((r, i) => {
    try {
      rows.push(clean(r));
    } catch {
      bad("importBadRow", i + 2);
    }
  });

  // Historial: una subida = un renglón, aunque llegue en varias tandas.
  let importId = Number(b.importId);
  if (Number.isInteger(importId) && importId > 0) {
    const own = await first<{ id: number }>("SELECT id FROM imports WHERE id = ? AND year = ?", importId, year);
    if (!own) importId = 0;
  } else importId = 0;
  if (!importId) {
    const filename = typeof b.filename === "string" ? b.filename.slice(0, 120) : "Excel";
    const res = await run(
      "INSERT INTO imports (filename, year, rows_in, rows_new, rows_updated, created_by) VALUES (?, ?, 0, 0, 0, ?)",
      filename,
      year,
      me.id
    );
    importId = Number(res.meta.last_row_id);
  }

  // Cuáles ya existían, para el conteo de nuevos vs. actualizados.
  const existing = new Set<string>();
  const jobsList = rows.map((r) => r.job);
  for (let i = 0; i < jobsList.length; i += 90) {
    const chunk = jobsList.slice(i, i + 90);
    const found = await all<{ job: string }>(
      `SELECT job FROM jobs WHERE year = ? AND job IN (${chunk.map(() => "?").join(",")})`,
      year,
      ...chunk
    );
    found.forEach((f) => existing.add(f.job));
  }

  // Equipos que no conocíamos: se dan de alta con un nombre provisional.
  const codes = [...new Set(rows.map((r) => r.team))];
  const known = new Set((await all<{ code: string }>("SELECT code FROM teams")).map((t) => t.code));
  const newTeams = codes.filter((c) => !known.has(c));
  const maxPos = (await first<{ p: number | null }>("SELECT MAX(position) AS p FROM teams"))?.p ?? 0;
  const db = await getD1();
  if (newTeams.length) {
    await db.batch(
      newTeams
        .sort(teamOrder)
        .map((c, i) =>
          db.prepare("INSERT OR IGNORE INTO teams (code, name, position) VALUES (?, ?, ?)").bind(c, defaultName(c), maxPos + i + 1)
        )
    );
  }

  const cols = [
    "year", "week", "job", "team_code", "part", "units", "inspected", "rejected", "passed",
    "est_hours", "act_hours", "rework_hours", ...DEFECTS.map((d) => `d_${d}`), "closed_on", "import_id",
  ];
  const updates = cols.filter((c) => c !== "year" && c !== "job").map((c) => `${c} = excluded.${c}`).join(", ");
  const sql = `INSERT INTO jobs (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
               ON CONFLICT(year, job) DO UPDATE SET ${updates}`;
  const stmt = db.prepare(sql);
  const statements = rows.map((r) =>
    stmt.bind(
      year, r.week, r.job, r.team, r.part, r.units, r.inspected, r.rejected, r.passed,
      r.est_hours, r.act_hours, r.rework_hours, ...DEFECTS.map((d) => r.defects[d]), r.closed_on, importId
    )
  );
  for (let i = 0; i < statements.length; i += 100) {
    await db.batch(statements.slice(i, i + 100));
  }

  const isNew = rows.filter((r) => !existing.has(r.job)).length;
  const weeks = rows.map((r) => r.week);
  await run(
    `UPDATE imports SET rows_in = rows_in + ?, rows_new = rows_new + ?, rows_updated = rows_updated + ?,
            first_week = MIN(COALESCE(first_week, ?), ?), last_week = MAX(COALESCE(last_week, ?), ?)
      WHERE id = ?`,
    rows.length,
    isNew,
    rows.length - isNew,
    Math.min(...weeks),
    Math.min(...weeks),
    Math.max(...weeks),
    Math.max(...weeks),
    importId
  );

  return NextResponse.json({ ok: true, importId, created: isNew, updated: rows.length - isNew, newTeams });
});
