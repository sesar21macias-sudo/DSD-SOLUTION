import { NextResponse } from "next/server";
import { polishAnnouncement } from "@/lib/ai";
import { bad, body, handler, text } from "@/lib/http";
import { requireEditor } from "@/lib/session";
import { clientIp, isLocked, recordFailure } from "@/lib/ratelimit";
import { HttpError } from "@/lib/session";

/** Pule y traduce un anuncio. Cualquier usuario con sesión; con freno para no gastar de más. */
export const POST = handler(async (req: Request) => {
  const me = await requireEditor();
  const b = await body<{ title: string; body: string }>(req);
  const title = text(b.title, 120);
  const msg = text(b.body, 800);
  if (!title && !msg) bad("textRequired");

  // Reutiliza la tabla de frenos: máx. 8 pulidas cada 15 minutos por persona.
  const key = `ai:${me.id}:${clientIp(req)}`;
  if (await isLocked(key)) throw new HttpError(429, "loginLocked");
  await recordFailure(key);

  const out = await polishAnnouncement(title, msg);
  if (!out) return NextResponse.json({ ok: false, unavailable: true });
  return NextResponse.json({ ok: true, ...out });
});
