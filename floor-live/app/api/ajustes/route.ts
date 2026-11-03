import { NextResponse } from "next/server";
import { body, dateOrNull, handler, intOrNull, numOrNull, text } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { saveSettings } from "@/lib/settings";
import type { Settings } from "@/lib/types";

export const PATCH = handler(async (req: Request) => {
  await requireAdmin();
  const b = await body<Record<keyof Settings, unknown>>(req);
  const patch: Partial<Settings> = {};
  if (b.plantName !== undefined) patch.plantName = text(b.plantName, 40) || "El Paso";
  if (b.goalFpy !== undefined) patch.goalFpy = numOrNull(b.goalFpy, 50, 100) ?? 95;
  if (b.goalEff !== undefined) patch.goalEff = numOrNull(b.goalEff, 50, 200) ?? 100;
  if (b.warnFpy !== undefined) patch.warnFpy = numOrNull(b.warnFpy, 0, 50) ?? 3;
  if (b.warnEff !== undefined) patch.warnEff = numOrNull(b.warnEff, 0, 100) ?? 10;
  if (b.safetySince !== undefined) patch.safetySince = dateOrNull(b.safetySince);
  if (b.safetyRecord !== undefined) patch.safetyRecord = intOrNull(b.safetyRecord, 0, 100_000) ?? 0;
  await saveSettings(patch);
  return NextResponse.json({ ok: true });
});
