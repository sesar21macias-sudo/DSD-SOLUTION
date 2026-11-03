import { NextResponse } from "next/server";
import { buildFeed } from "@/lib/feed";
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
