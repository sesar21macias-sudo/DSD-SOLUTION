import type { Rates } from "@/lib/feed-types";
import type { Dict } from "@/lib/i18n/dict";
import { pct, pointsDelta, toneFor, type Tone } from "@/lib/status";
import { ToneGlyph } from "../tv/glyphs";
import { cx } from "../ui";

/** Piezas del panel que comparten el lenguaje visual de la tele (semáforo + palabra + ícono). */

export function ToneBadge({ tone, d, className }: { tone: Tone; d: Dict; className?: string }) {
  return (
    <span className={cx(`chip-${tone} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold`, className)}>
      <ToneGlyph tone={tone} />
      {d.tone[tone]}
    </span>
  );
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[2.6rem] leading-[1.02] tracking-[-0.015em] md:text-[3.1rem]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[0.9375rem] text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiPanel({
  label,
  value,
  prev,
  month,
  ytd,
  goal,
  warn,
  d,
  delayMs = 0,
}: {
  label: string;
  value: number | null;
  prev: number | null;
  month: number | null;
  ytd: number | null;
  goal: number;
  warn: number;
  d: Dict;
  delayMs?: number;
}) {
  const tone = toneFor(value === null ? null : value * 100, goal, warn);
  const delta = pointsDelta(value, prev);
  return (
    <div className={`panel lit rise tone-${tone} overflow-hidden p-5`} style={{ animationDelay: `${delayMs}ms` }}>
      <div className="absolute inset-x-0 top-0 h-[3px] bg-current opacity-90" style={{ boxShadow: "0 0 18px currentColor" }} />
      <div className="flex items-center justify-between gap-3">
        <span className="font-stencil text-[1.05rem] font-extrabold uppercase tracking-[0.1em] text-ink">{label}</span>
        <ToneBadge tone={tone} d={d} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-board text-[4.2rem] font-extrabold leading-[0.85] tabular-nums">{pct(value)}</span>
        <span className="pb-1 text-right text-xs text-ink-faint">
          {d.common.goal} <b className="font-board text-base text-ink">{goal}%</b>
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] text-ink-soft">
        {delta !== null ? (
          <span className={delta > 0.05 ? "tone-good" : delta < -0.05 ? "tone-bad" : "tone-none"}>
            {d.panel.vsLast(`${delta > 0 ? "▲" : delta < 0 ? "▼" : "="} ${Math.abs(delta).toFixed(1)} pts`)}
          </span>
        ) : (
          <span />
        )}
        <span>
          {d.panel.month} <b className="text-ink">{pct(month)}</b> · {d.panel.ytd} <b className="text-ink">{pct(ytd)}</b>
        </span>
      </div>
    </div>
  );
}

export function MiniRates({ rates, goals, d }: { rates: Rates; goals: { goalFpy: number; goalEff: number; warnFpy: number; warnEff: number }; d: Dict }) {
  const q = toneFor(rates.fpy === null ? null : rates.fpy * 100, goals.goalFpy, goals.warnFpy);
  const e = toneFor(rates.eff === null ? null : rates.eff * 100, goals.goalEff, goals.warnEff);
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: d.common.quality, v: rates.fpy, tone: q },
        { label: d.common.efficiency, v: rates.eff, tone: e },
      ].map((x) => (
        <div key={x.label} className={`rounded-xl bg-surface-2 px-3 py-2.5 tone-${x.tone}`}>
          <div className="flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-[0.06em] text-ink-faint">
            {x.label}
            <ToneGlyph tone={x.tone} />
          </div>
          <div className="mt-0.5 font-board text-[1.9rem] font-extrabold leading-none tabular-nums">{pct(x.v)}</div>
        </div>
      ))}
    </div>
  );
}
