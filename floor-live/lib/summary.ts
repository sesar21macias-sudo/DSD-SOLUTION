import type { ScopeStats } from "./feed-types";
import { pct, pointsDelta } from "./status";
import type { Defect, Lang, Settings } from "./types";

/**
 * Resumen en una o dos frases cortas, sin jerga, para cuando no hay llave de
 * Claude (o mientras se genera). Lo mismo que diría un supervisor en voz alta.
 */

export const DEFECT_NAMES: Record<Lang, Record<Defect, string>> = {
  en: {
    majors: "Majors",
    stitching: "Stitching",
    seams: "Seams",
    binding: "Binding",
    webbing: "Webbing",
    labeling: "Labeling",
    hardware: "Hardware",
    construction: "Construction",
    fabric: "Fabric",
  },
  es: {
    majors: "Mayores",
    stitching: "Costura",
    seams: "Costuras de unión",
    binding: "Ribete",
    webbing: "Cinta",
    labeling: "Etiquetas",
    hardware: "Herrajes",
    construction: "Construcción",
    fabric: "Tela",
  },
};

export function ruleSummary(stats: ScopeStats, s: Settings, lang: Lang, who: string): string {
  const fpy = stats.current.fpy;
  const eff = stats.current.eff;
  const fpyOk = fpy !== null && fpy * 100 >= s.goalFpy;
  const effOk = eff !== null && eff * 100 >= s.goalEff;
  const dq = pointsDelta(fpy, stats.prev?.fpy ?? null);
  const top = stats.defects[0];
  const en = lang === "en";

  const parts: string[] = [];
  if (fpyOk && effOk) {
    parts.push(en ? `${who} hit both goals this week. Great work!` : `${who} cumplió las dos metas esta semana. ¡Buen trabajo!`);
  } else if (fpyOk) {
    parts.push(
      en
        ? `Quality is on target (${pct(fpy)}). Speed is at ${pct(eff, 0)}, goal is ${s.goalEff}%.`
        : `La calidad va en meta (${pct(fpy)}). La eficiencia va en ${pct(eff, 0)}, la meta es ${s.goalEff}%.`
    );
  } else if (effOk) {
    parts.push(
      en
        ? `Speed is on target (${pct(eff, 0)}). Quality is at ${pct(fpy)}, goal is ${s.goalFpy}%.`
        : `La eficiencia va en meta (${pct(eff, 0)}). La calidad va en ${pct(fpy)}, la meta es ${s.goalFpy}%.`
    );
  } else {
    parts.push(
      en
        ? `Quality ${pct(fpy)} and efficiency ${pct(eff, 0)} are below goal this week.`
        : `Calidad ${pct(fpy)} y eficiencia ${pct(eff, 0)} van debajo de la meta esta semana.`
    );
  }

  if (dq !== null && Math.abs(dq) >= 1) {
    parts.push(
      en
        ? `Quality ${dq > 0 ? "went up" : "went down"} ${Math.abs(dq)} points vs last week.`
        : `La calidad ${dq > 0 ? "subió" : "bajó"} ${Math.abs(dq)} puntos contra la semana pasada.`
    );
  } else if (top) {
    const name = DEFECT_NAMES[lang][top.key];
    parts.push(en ? `Top defect this month: ${name}. Check it first.` : `Defecto #1 del mes: ${name}. Revísalo primero.`);
  }
  return parts.join(" ");
}
