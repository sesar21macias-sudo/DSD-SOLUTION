import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TV_COOKIE, displayBySecret, touch } from "@/lib/displays";
import { buildFeed, parseHidden } from "@/lib/feed";
import { handler } from "@/lib/http";

/** Lo que muestra una tele conectada. 401 = sin alta (la tele pide código); 202 = esperando al admin. */
export const GET = handler(async () => {
  const d = await displayBySecret((await cookies()).get(TV_COOKIE)?.value);
  if (!d) return NextResponse.json({ status: "unpaired" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (d.status === "pending") {
    return NextResponse.json(
      { status: "pending", code: d.pair_code, expires: d.pair_expires },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  }
  await touch(d);
  const feed = await buildFeed({
    kind: d.scope,
    teamId: d.team_id,
    lang: d.lang,
    displayName: d.name,
    slideSeconds: d.slide_seconds,
    hidden: parseHidden(d.hidden_slides),
  });
  return NextResponse.json({ status: "active", feed }, { headers: { "Cache-Control": "no-store" } });
});
