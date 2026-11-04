import { NextResponse } from "next/server";
import { first } from "@/lib/db";
import { buildFeed, parseHidden } from "@/lib/feed";
import type { DisplayRow } from "@/lib/displays";
import { handler } from "@/lib/http";
import { langOfRequest } from "@/lib/i18n/server";
import { HttpError, canView, requireUser } from "@/lib/session";

/** La misma pantalla que ve una tele, pero con sesión: ?team=<id> o la de planta. */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const raw = url.searchParams.get("team");
  const teamId = raw ? Number(raw) : null;
  const lang = url.searchParams.get("lang") === "es" ? "es" : url.searchParams.get("lang") === "en" ? "en" : langOfRequest(req);

  const user = await requireUser();

  // Vista previa de una tele conectada, con sus láminas, idioma y segundos.
  const displayId = Number(url.searchParams.get("display"));
  if (Number.isInteger(displayId) && displayId > 0) {
    if (user.role !== "admin" || user.display_only) throw new HttpError(403, "adminOnly");
    const dsp = await first<DisplayRow>("SELECT * FROM displays WHERE id = ? AND status = 'active'", displayId);
    if (!dsp) throw new HttpError(404, "notFound");
    const feed = await buildFeed({
      kind: dsp.scope,
      teamId: dsp.team_id,
      lang: dsp.lang,
      displayName: dsp.name,
      slideSeconds: dsp.slide_seconds,
      hidden: parseHidden(dsp.hidden_slides),
    });
    return NextResponse.json({ status: "active", feed }, { headers: { "Cache-Control": "no-store" } });
  }
  if (teamId !== null && (!Number.isInteger(teamId) || !canView(user, teamId))) throw new HttpError(403, "notYourTeam");

  const feed = await buildFeed({
    kind: teamId ? "team" : "plant",
    teamId: teamId && Number.isInteger(teamId) ? teamId : null,
    lang,
    displayName: "",
    slideSeconds: Number(url.searchParams.get("s")) >= 6 ? Math.min(120, Number(url.searchParams.get("s"))) : 15,
  });
  return NextResponse.json({ status: "active", feed }, { headers: { "Cache-Control": "no-store" } });
});
