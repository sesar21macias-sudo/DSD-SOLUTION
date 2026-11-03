import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { bad, body, handler, text } from "@/lib/http";
import { latestWeek } from "@/lib/metrics";
import { requireAdmin } from "@/lib/session";

/**
 * El admin corrige a mano la frase de la semana (planta o un equipo), en ambos idiomas.
 * Se guarda igual que la de Claude; "Volver a escribir" la reemplaza.
 */
export const PUT = handler(async (req: Request) => {
  await requireAdmin();
  const b = await body<{ scope: string; es: string; en: string }>(req);
  const scope = text(b.scope, 20);
  if (scope !== "plant" && !(await first("SELECT id FROM teams WHERE code = ?", scope))) bad("teamRequired");
  const latest = await latestWeek();
  if (!latest) bad("importEmpty");
  for (const lang of ["es", "en"] as const) {
    const t = text(b[lang], 300);
    if (!t) continue;
    await run(
      `INSERT INTO insights (scope, year, week, lang, text) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(scope, year, week, lang) DO UPDATE SET text = excluded.text, created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      scope,
      latest.year,
      latest.week,
      lang,
      t
    );
  }
  return NextResponse.json({ ok: true });
});
