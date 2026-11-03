import { NextResponse } from "next/server";
import { run } from "@/lib/db";
import { bad, body, handler, idParam, text } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const id = idParam((await params).id);
  const b = await body<{ name: string; leader: string; active: boolean }>(req);
  const name = text(b.name, 40);
  if (!name) bad("nameRequired");
  await run(
    "UPDATE teams SET name = ?, leader = ?, active = ? WHERE id = ?",
    name,
    text(b.leader, 60),
    b.active === false ? 0 : 1,
    id
  );
  return NextResponse.json({ ok: true });
});
