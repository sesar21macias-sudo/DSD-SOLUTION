import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/ai";
import { handler } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

/** Reescribe los resúmenes de la semana más reciente (se llama al terminar de subir el Excel). */
export const POST = handler(async () => {
  await requireAdmin();
  const res = await generateInsights();
  return NextResponse.json({ ok: true, ...res });
});
