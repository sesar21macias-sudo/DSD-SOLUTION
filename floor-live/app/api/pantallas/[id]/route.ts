import { NextResponse } from "next/server";
import { first, run } from "@/lib/db";
import { bad, body, handler, idParam, intOrNull, notFound, oneOf, text } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { SLIDE_KEYS, type SlideKey } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const id = idParam((await params).id);
  if (!(await first("SELECT id FROM displays WHERE id = ? AND status = 'active'", id))) notFound();
  const b = await body<{ name: string; scope: string; teamId: number; lang: string; seconds: number; hidden: unknown }>(req);
  const hidden = Array.isArray(b.hidden) ? [...new Set(b.hidden.filter((x): x is SlideKey => SLIDE_KEYS.includes(x as SlideKey)))] : null;
  const scope = oneOf(b.scope, ["plant", "team"] as const, "plant");
  let teamId: number | null = null;
  if (scope === "team") {
    const t = await first<{ id: number }>("SELECT id FROM teams WHERE id = ?", Number(b.teamId));
    if (!t) bad("teamRequired");
    teamId = t.id;
  }
  await run(
    "UPDATE displays SET name = ?, scope = ?, team_id = ?, lang = ?, slide_seconds = ?, hidden_slides = COALESCE(?, hidden_slides) WHERE id = ?",
    text(b.name, 40),
    scope,
    teamId,
    oneOf(b.lang, ["en", "es"] as const, "en"),
    intOrNull(b.seconds, 6, 120) ?? 15,
    hidden === null ? null : JSON.stringify(hidden),
    id
  );
  return NextResponse.json({ ok: true });
});

/** Desconectar = borrar el renglón; la cookie de esa tele ya no abre nada. */
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  await run("DELETE FROM displays WHERE id = ?", idParam((await params).id));
  return NextResponse.json({ ok: true });
});
