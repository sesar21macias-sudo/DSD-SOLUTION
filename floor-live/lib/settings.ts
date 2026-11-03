import "server-only";
import { all, run } from "./db";
import type { Settings } from "./types";

/** Ajustes de planta en app_config (clave → texto). Lo que falte toma su valor por omisión. */
const DEFAULTS: Settings = {
  plantName: "El Paso",
  goalFpy: 95,
  goalEff: 100,
  warnFpy: 3,
  warnEff: 10,
  safetySince: null,
  safetyRecord: 0,
};

const KEYS: Record<keyof Settings, string> = {
  plantName: "plant_name",
  goalFpy: "goal_fpy",
  goalEff: "goal_eff",
  warnFpy: "warn_fpy",
  warnEff: "warn_eff",
  safetySince: "safety_since",
  safetyRecord: "safety_record",
};

export async function getSettings(): Promise<Settings> {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM app_config WHERE key IN (${Object.values(KEYS).map(() => "?").join(",")})`,
    ...Object.values(KEYS)
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: keyof Settings) => {
    const v = Number(map.get(KEYS[k]));
    return Number.isFinite(v) && map.has(KEYS[k]) ? v : (DEFAULTS[k] as number);
  };
  return {
    plantName: map.get(KEYS.plantName) || DEFAULTS.plantName,
    goalFpy: num("goalFpy"),
    goalEff: num("goalEff"),
    warnFpy: num("warnFpy"),
    warnEff: num("warnEff"),
    safetySince: map.get(KEYS.safetySince) || null,
    safetyRecord: num("safetyRecord"),
  };
}

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  for (const [k, v] of Object.entries(s) as [keyof Settings, unknown][]) {
    if (v === undefined) continue;
    if (v === null || v === "") {
      await run("DELETE FROM app_config WHERE key = ?", KEYS[k]);
      continue;
    }
    await run(
      "INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      KEYS[k],
      String(v)
    );
  }
}
