"use client";

import { useEffect, useState } from "react";
import type { Feed, FeedAnnouncement, FeedPhoto, JobRow, RankRow, ScopeStats, WeekPoint } from "@/lib/feed-types";
import type { Dict } from "@/lib/i18n/dict";
import { monthName } from "@/lib/dates";
import { pct, pointsDelta, toneFor, type Tone } from "@/lib/status";
import { DEFECT_NAMES } from "@/lib/summary";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { KindGlyph, Shield, Spark, ToneGlyph } from "./glyphs";

/** Medida relativa al escenario de la tele (ver .tv-stage en tv.css). */
export const u = (n: number) => `calc(var(--u) * ${n})`;

const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

/* ---------- Piezas ---------- */

function ToneChip({ tone, d, size = 1.7 }: { tone: Tone; d: Dict; size?: number }) {
  return (
    <span
      className={`chip-${tone} inline-flex items-center rounded-full font-semibold uppercase`}
      style={{ gap: u(0.6), padding: `${u(0.45)} ${u(1.2)} ${u(0.45)} ${u(0.9)}`, fontSize: u(size), letterSpacing: "0.04em" }}
    >
      <ToneGlyph tone={tone} />
      {d.tone[tone]}
    </span>
  );
}

/** Cuenta desde 0 hasta el valor al entrar la lámina. */
function CountUp({ value, decimals = 1, suffix = "%" }: { value: number; decimals?: number; suffix?: string }) {
  const [target, setTarget] = useState(0);
  useEffect(() => setTarget(value), [value]);
  const shown = useAnimatedNumber(target, 1500);
  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  );
}

function Delta({ now, before, d }: { now: number | null; before: number | null; d: Dict }) {
  const delta = pointsDelta(now, before);
  if (delta === null) return null;
  const abs = Math.abs(delta).toFixed(1);
  const cls = delta > 0.05 ? "tone-good" : delta < -0.05 ? "tone-bad" : "tone-none";
  const text = delta > 0.05 ? d.tv.up(abs) : delta < -0.05 ? d.tv.down(abs) : d.tv.sameAsLast;
  return (
    <span className="font-semibold" style={{ fontSize: u(1.7) }}>
      <span className={cls}>{text}</span>
      {Math.abs(delta) > 0.05 && <span className="text-ink-faint"> {d.tv.vsLast("").trim()}</span>}
    </span>
  );
}

function Meter({ value, goal, min, max, tone }: { value: number; goal: number; min: number; max: number; tone: Tone }) {
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`;
  return (
    <div className={`meter tone-${tone}`}>
      <div className="meter-fill" style={{ width: pos(value) }} />
      <div className="meter-goal" style={{ left: pos(goal) }} />
    </div>
  );
}

function KpiCard({
  label,
  help,
  value,
  prev,
  month,
  ytd,
  goal,
  warn,
  scale,
  d,
  i,
}: {
  label: string;
  help: string;
  value: number | null;
  prev: number | null;
  month: number | null;
  ytd: number | null;
  goal: number;
  warn: number;
  scale: [number, number];
  d: Dict;
  i: number;
}) {
  const tone = toneFor(value === null ? null : value * 100, goal, warn);
  const v = value === null ? null : value * 100;
  return (
    <div data-in data-tone={tone} className={`tv-card tone-${tone} flex flex-col`} style={{ ...delay(i), padding: `${u(2.2)} ${u(2.4)}`, gap: u(1.1) }}>
      <div className="flex items-start justify-between" style={{ gap: u(1) }}>
        <div>
          <div className="font-stencil font-extrabold uppercase text-ink" style={{ fontSize: u(2.3), letterSpacing: "0.08em" }}>
            {label}
          </div>
          <div className="whitespace-nowrap text-ink-faint" style={{ fontSize: u(1.35) }}>
            {help}
          </div>
        </div>
        <ToneChip tone={tone} d={d} size={1.45} />
      </div>

      <div className="flex items-end justify-between" style={{ gap: u(2) }}>
        <div className="tv-num" style={{ fontSize: u(9.6) }}>
          {v === null ? "—" : <CountUp value={v} decimals={v >= 100 ? 0 : 1} />}
        </div>
        <div className="flex flex-col items-end whitespace-nowrap text-ink-soft" style={{ gap: u(0.5), paddingBottom: u(0.4), fontSize: u(1.45) }}>
          <span className="font-stencil font-bold uppercase text-ink" style={{ fontSize: u(2), letterSpacing: "0.06em" }}>
            {d.tv.goal(goal)}
          </span>
          <span>
            {d.tv.month} <b className="font-board text-ink" style={{ fontSize: u(1.9) }}>{pct(month)}</b>
          </span>
          <span>
            {d.tv.ytd} <b className="font-board text-ink" style={{ fontSize: u(1.9) }}>{pct(ytd)}</b>
          </span>
        </div>
      </div>

      {v !== null && <Meter value={v} goal={goal} min={scale[0]} max={Math.max(scale[1], v + 5)} tone={tone} />}

      <div className="mt-auto whitespace-nowrap" style={{ paddingTop: u(0.2) }}>
        <Delta now={value} before={prev} d={d} />
      </div>
    </div>
  );
}

function Insight({ text, d, i }: { text: string | null; d: Dict; i: number }) {
  if (!text) return null;
  return (
    <div
      data-in
      className="flex items-center rounded-full border border-line-strong bg-surface/70"
      style={{ ...delay(i), gap: u(1.4), padding: `${u(0.9)} ${u(2)}` }}
    >
      <span className="flex flex-none items-center font-stencil font-bold uppercase text-red-text" style={{ gap: u(0.6), fontSize: u(1.45), letterSpacing: "0.1em" }}>
        <Spark />
        {d.tv.insight}
      </span>
      <span className="line-clamp-2 text-ink" style={{ fontSize: u(1.75), lineHeight: 1.22 }}>
        {text}
      </span>
    </div>
  );
}

function SlideHead({ kicker, title, aside, i = 0 }: { kicker: string; title: string; aside?: React.ReactNode; i?: number }) {
  return (
    <div data-in className="flex items-end justify-between" style={{ ...delay(i), gap: u(2), marginBottom: u(1.6) }}>
      <div>
        <div className="tv-kicker">{kicker}</div>
        <h2 className="tv-title" style={{ marginTop: u(0.6) }}>
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

/* ---------- Láminas ---------- */

export function SafetySlide({ feed, d }: { feed: Feed; d: Dict }) {
  const days = feed.safety.days ?? 0;
  // La barra de récord solo aparece cuando la planta capturó uno en Equipos.
  const record = Math.max(feed.safety.record, days);
  const isRecord = feed.safety.record > 0 && days >= feed.safety.record;
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "1.35fr 1fr", gap: u(4) }}>
      <div className="flex flex-col justify-center">
        <div data-in className="tv-kicker" style={delay(0)}>
          {d.tv.safetyKicker} · {feed.plantName}
        </div>
        <div data-in className="led" style={{ ...delay(1), fontSize: u(26), marginTop: u(1) }}>
          <CountUp value={days} decimals={0} suffix="" />
        </div>
        <div data-in className="font-display" style={{ ...delay(2), fontSize: u(4.4), lineHeight: 1.02, marginTop: u(1.4), maxWidth: u(48) }}>
          {d.tv.safetyDays(days)}
        </div>
        {feed.safety.record > 0 && (
          <div data-in style={{ ...delay(3), marginTop: u(2.6), maxWidth: u(46) }}>
            <div className="flex justify-between text-ink-soft" style={{ fontSize: u(1.7), marginBottom: u(0.8) }}>
              <span className={isRecord ? "font-semibold text-red-text" : undefined}>
                {isRecord ? d.tv.safetyNewRecord : d.tv.safetyRecord(feed.safety.record)}
              </span>
              <span className="font-board text-ink" style={{ fontSize: u(2) }}>
                {days} / {record}
              </span>
            </div>
            <div className="meter" style={{ color: "var(--color-red)" }}>
              <div className="meter-fill" style={{ width: `${Math.min(100, (days / record) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      <div data-in className="tv-card flex flex-col items-center justify-center text-center" style={{ ...delay(2), padding: u(3), gap: u(2) }}>
        <Shield className="text-red-text" style={{ fontSize: u(14), filter: "drop-shadow(0 0 2rem oklch(0.6 0.22 26 / 0.6))" }} />
        <p className="font-display italic text-ink" style={{ fontSize: u(3.3), lineHeight: 1.1 }}>
          {d.tv.safetyMotto}
        </p>
      </div>
    </div>
  );
}

export function KpiSlide({
  stats,
  feed,
  d,
  kicker,
  title,
  insight,
  rank,
}: {
  stats: ScopeStats;
  feed: Feed;
  d: Dict;
  kicker: string;
  title: string;
  insight: string | null;
  rank?: Feed["teamRank"];
}) {
  const g = feed.goals;
  return (
    <div className="flex h-full flex-col">
      <SlideHead
        kicker={kicker}
        title={title}
        aside={
          <div className="text-right">
            <div className="font-stencil font-extrabold uppercase text-ink" style={{ fontSize: u(2.6), letterSpacing: "0.06em" }}>
              {d.tv.week(stats.week)}
            </div>
            <div className="text-ink-faint" style={{ fontSize: u(1.6) }}>
              {rank?.quality ? d.tv.rank(rank.quality, rank.of) + " · " : ""}
              {d.panel.units(stats.current.units)}
            </div>
          </div>
        }
      />
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 1fr", gap: u(2.4) }}>
        <KpiCard
          label={d.common.quality}
          help={d.tv.qualityHelp}
          value={stats.current.fpy}
          prev={stats.prev?.fpy ?? null}
          month={stats.monthRates.fpy}
          ytd={stats.ytd.fpy}
          goal={g.goalFpy}
          warn={g.warnFpy}
          scale={[70, 100]}
          d={d}
          i={1}
        />
        <KpiCard
          label={d.common.efficiency}
          help={d.tv.effHelp}
          value={stats.current.eff}
          prev={stats.prev?.eff ?? null}
          month={stats.monthRates.eff}
          ytd={stats.ytd.eff}
          goal={g.goalEff}
          warn={g.warnEff}
          scale={[40, 130]}
          d={d}
          i={2}
        />
      </div>
      <div style={{ marginTop: u(1.6) }}>
        <Insight text={insight} d={d} i={3} />
      </div>
    </div>
  );
}

function TrendChart({
  points,
  pick,
  goal,
  warn,
  min,
  label,
  d,
  i,
}: {
  points: WeekPoint[];
  pick: (p: WeekPoint) => number | null;
  goal: number;
  warn: number;
  min: number;
  label: string;
  d: Dict;
  i: number;
}) {
  const values = points.map((p) => (pick(p) === null ? null : pick(p)! * 100));
  const max = Math.max(goal + 5, ...values.map((v) => v ?? 0)) + 3;
  const y = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`;
  return (
    <div data-in className="tv-card flex flex-col" style={{ ...delay(i), padding: `${u(2)} ${u(2.4)} ${u(1.6)}` }}>
      <div className="flex items-baseline justify-between">
        <span className="font-stencil font-extrabold uppercase" style={{ fontSize: u(2.3), letterSpacing: "0.08em" }}>
          {label}
        </span>
        <span className="font-stencil font-bold uppercase text-ink-soft" style={{ fontSize: u(1.6), letterSpacing: "0.06em" }}>
          {d.tv.goal(goal)}
        </span>
      </div>
      <div className="relative flex-1" style={{ marginTop: u(4.2), marginBottom: u(0.6) }}>
        {/* Línea de meta */}
        <div className="absolute inset-x-0 border-t-2 border-dashed border-ink/70" style={{ bottom: y(goal), zIndex: 1 }} />
        <div className="absolute inset-0 flex items-end" style={{ gap: u(1.2) }}>
          {points.map((p, k) => {
            const v = values[k];
            const tone = toneFor(v, goal, warn);
            const last = k === points.length - 1;
            return (
              <div key={p.week} className="flex h-full flex-1 flex-col justify-end text-center">
                <div
                  className={`tv-num tone-${tone}`}
                  style={{ fontSize: u(last ? 2.6 : 2.1), marginBottom: u(0.5), fontWeight: last ? 900 : 700 }}
                >
                  {v === null ? "—" : `${v >= 100 ? Math.round(v) : v.toFixed(1)}`}
                </div>
                <div
                  className={`trend-bar rounded-t-md tone-${tone}`}
                  style={{
                    ...delay(k),
                    height: v === null ? 0 : y(v),
                    background: "currentColor",
                    opacity: last ? 1 : 0.55,
                    boxShadow: last ? "0 0 1.6rem currentColor" : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex" style={{ gap: u(1.2) }}>
        {points.map((p, k) => (
          <div
            key={p.week}
            className={`flex-1 text-center font-board ${k === points.length - 1 ? "text-ink" : "text-ink-faint"}`}
            style={{ fontSize: u(1.7), fontWeight: 700 }}
          >
            {d.common.weekShort(p.week)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendSlide({ stats, feed, d, kicker }: { stats: ScopeStats; feed: Feed; d: Dict; kicker: string }) {
  const g = feed.goals;
  return (
    <div className="flex h-full flex-col">
      <SlideHead kicker={kicker} title={d.tv.trendTitle} aside={<span className="text-ink-soft" style={{ fontSize: u(1.8) }}>{d.tv.trendHelp}</span>} />
      <div className="grid flex-1" style={{ gridTemplateColumns: "1fr 1fr", gap: u(2.4) }}>
        <TrendChart points={stats.trend} pick={(p) => p.fpy} goal={g.goalFpy} warn={g.warnFpy} min={60} label={d.common.quality} d={d} i={1} />
        <TrendChart points={stats.trend} pick={(p) => p.eff} goal={g.goalEff} warn={g.warnEff} min={30} label={d.common.efficiency} d={d} i={2} />
      </div>
    </div>
  );
}

function RankColumn({ rows, label, highlight, d, i }: { rows: RankRow[]; label: string; highlight?: string; d: Dict; i: number }) {
  const shown = rows.slice(0, 11);
  const max = Math.max(...shown.map((r) => r.value), 0.0001);
  // Las barras arrancan un poco abajo del peor valor: así 97% vs 100% se nota a simple vista.
  const floor = Math.max(0, Math.min(...shown.map((r) => r.value)) - 0.1);
  const rowH = Math.min(3.6, 30 / Math.max(shown.length, 1));
  return (
    <div data-in className="tv-card flex flex-col" style={{ ...delay(i), padding: `${u(1.8)} ${u(2.2)}` }}>
      <div className="font-stencil font-extrabold uppercase" style={{ fontSize: u(2.3), letterSpacing: "0.08em", marginBottom: u(1.1) }}>
        {label}
      </div>
      <div className="flex flex-1 flex-col justify-between">
        {shown.map((r, k) => {
          const me = highlight === r.code;
          return (
            <div
              key={r.code}
              className={`grid items-center rounded-lg ${me ? "bg-red-wash ring-2 ring-red" : ""}`}
              style={{ gridTemplateColumns: `${u(3)} ${u(13)} 1fr ${u(8)} ${u(2.4)}`, gap: u(1), height: u(rowH), padding: `0 ${u(0.6)}` }}
            >
              <span className={`tv-num ${k < 3 ? "text-ink" : "text-ink-faint"}`} style={{ fontSize: u(rowH * 0.7) }}>
                {k + 1}
              </span>
              <span className="truncate font-semibold" style={{ fontSize: u(rowH * 0.48) }}>
                {r.name}
                {me && <span className="ml-2 font-stencil text-red-text" style={{ fontSize: u(rowH * 0.36) }}>◀ {d.tv.teamKicker}</span>}
              </span>
              <div className="relative h-[38%] rounded-full bg-white/[0.06]">
                <div
                  className={`rank-bar absolute inset-y-0 left-0 rounded-full tone-${r.tone}`}
                  style={{ ...delay(k), width: `${Math.max(4, ((r.value - floor) / (max - floor)) * 100)}%`, background: "currentColor", opacity: 0.85 }}
                />
              </div>
              <span className={`tv-num text-right tone-${r.tone}`} style={{ fontSize: u(rowH * 0.62) }}>
                {pct(r.value, r.value >= 1 ? 0 : 1)}
              </span>
              <ToneGlyph tone={r.tone} className={`tone-${r.tone}`} style={{ fontSize: u(rowH * 0.5) }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RankingsSlide({ feed, d, highlight }: { feed: Feed; d: Dict; highlight?: string }) {
  if (!feed.rankings || !feed.plant) return null;
  return (
    <div className="flex h-full flex-col">
      <SlideHead
        kicker={`${d.tv.plantKicker} · ${d.tv.week(feed.plant.week)}`}
        title={d.tv.rankingsTitle}
        aside={<span className="text-ink-soft" style={{ fontSize: u(1.8) }}>{d.tv.rankingsHelp}</span>}
      />
      <div className="grid flex-1" style={{ gridTemplateColumns: "1fr 1fr", gap: u(2.4) }}>
        <RankColumn rows={feed.rankings.quality} label={d.common.quality} highlight={highlight} d={d} i={1} />
        <RankColumn rows={feed.rankings.efficiency} label={d.common.efficiency} highlight={highlight} d={d} i={2} />
      </div>
    </div>
  );
}

export function DefectsSlide({ stats, d, kicker }: { stats: ScopeStats; d: Dict; kicker: string }) {
  const names = DEFECT_NAMES[d.locale.startsWith("es") ? "es" : "en"];
  const top = stats.defects.slice(0, 3);
  const rest = stats.defects.slice(3);
  const max = top[0]?.count ?? 1;
  return (
    <div className="flex h-full flex-col">
      <SlideHead
        kicker={kicker}
        title={`${d.tv.defectsTitle} · ${monthName(stats.month, d.locale)}`}
        aside={<span className="text-ink-soft" style={{ fontSize: u(1.8) }}>{d.tv.defectsHelp}</span>}
      />
      {top.length === 0 ? (
        <div data-in className="tv-card tone-good flex flex-1 items-center justify-center" style={{ ...delay(1), gap: u(2) }} data-tone="good">
          <ToneGlyph tone="good" style={{ fontSize: u(8) }} />
          <span className="font-display" style={{ fontSize: u(5) }}>{d.tv.noDefects}</span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col" style={{ gap: u(1.3) }}>
          {top.map((r, k) => (
            <div
              key={r.key}
              data-in
              className="tv-card grid items-center"
              style={{ ...delay(k + 1), gridTemplateColumns: `${u(9)} 1fr ${u(14)}`, gap: u(2.4), padding: `${u(1)} ${u(2.4)}`, flex: k === 0 ? 1.25 : 1, minHeight: 0 }}
            >
              <span className={`tv-num ${k === 0 ? "text-red-text" : "text-ink-soft"}`} style={{ fontSize: u(k === 0 ? 7 : 5.2) }}>
                #{k + 1}
              </span>
              <div>
                <div className="font-semibold" style={{ fontSize: u(k === 0 ? 3.6 : 2.8) }}>
                  {names[r.key]}
                </div>
                <div className="meter" style={{ marginTop: u(1), color: k === 0 ? "var(--color-red)" : "var(--color-ink-soft)" }}>
                  <div className="meter-fill" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
              </div>
              <span className="tv-num text-right" style={{ fontSize: u(k === 0 ? 7 : 5.2) }}>
                {r.count}
              </span>
            </div>
          ))}
          {rest.length > 0 && (
            <div data-in className="flex flex-wrap items-center text-ink-soft" style={{ ...delay(4), gap: u(1.2), fontSize: u(1.9) }}>
              {rest.map((r) => (
                <span key={r.key} className="rounded-full bg-surface-2" style={{ padding: `${u(0.4)} ${u(1.2)}` }}>
                  {names[r.key]} <b className="font-board text-ink">{r.count}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function JobsSlide({ jobs, feed, d, kicker }: { jobs: JobRow[]; feed: Feed; d: Dict; kicker: string }) {
  const g = feed.goals;
  const shown = jobs.slice(0, 6);
  return (
    <div className="flex h-full flex-col">
      <SlideHead kicker={kicker} title={d.tv.jobsTitle} />
      <div data-in className="tv-card flex-1" style={{ ...delay(1), padding: `${u(1.2)} ${u(2.4)}` }}>
        <div
          className="grid border-b border-line font-stencil font-bold uppercase text-ink-faint"
          style={{ gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1fr", fontSize: u(1.5), letterSpacing: "0.08em", padding: `${u(0.8)} 0` }}
        >
          <span>{d.data.colJob}</span>
          <span>{d.data.colPart}</span>
          <span className="text-right">{d.data.colUnits}</span>
          <span className="text-right">{d.common.quality}</span>
          <span className="text-right">{d.common.efficiency}</span>
        </div>
        {shown.map((j, k) => {
          const qt = toneFor(j.fpy === null ? null : j.fpy * 100, g.goalFpy, g.warnFpy);
          const et = toneFor(j.eff === null ? null : j.eff * 100, g.goalEff, g.warnEff);
          return (
            <div
              key={j.job}
              data-in
              className="grid items-center border-b border-line last:border-0"
              style={{ ...delay(k + 2), gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1fr", height: u(5.2) }}
            >
              <span className="tv-num" style={{ fontSize: u(3) }}>{j.job}</span>
              <span className="truncate text-ink-soft" style={{ fontSize: u(2) }}>{j.part}</span>
              <span className="tv-num text-right" style={{ fontSize: u(3) }}>
                {j.passed}<span className="text-ink-faint" style={{ fontSize: u(2) }}>/{j.inspected}</span>
              </span>
              <span className={`flex items-center justify-end tv-num tone-${qt}`} style={{ fontSize: u(3), gap: u(0.6) }}>
                <ToneGlyph tone={qt} style={{ fontSize: u(2) }} />
                {pct(j.fpy, 0)}
              </span>
              <span className={`flex items-center justify-end tv-num tone-${et}`} style={{ fontSize: u(3), gap: u(0.6) }}>
                <ToneGlyph tone={et} style={{ fontSize: u(2) }} />
                {pct(j.eff, 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  news: "var(--color-ink)",
  celebration: "var(--color-warn)",
  safety: "var(--color-good)",
  reminder: "var(--color-red-text)",
};

export function AnnouncementSlide({ a, d, mediaUrl }: { a: FeedAnnouncement; d: Dict; mediaUrl: (id: number) => string }) {
  const hasPhoto = a.mediaId !== null;
  return (
    <div className="grid h-full items-center" style={{ gridTemplateColumns: hasPhoto ? "1.1fr 1fr" : "1fr", gap: u(4) }}>
      <div className={hasPhoto ? "" : "mx-auto max-w-[80%] text-center"}>
        <div
          data-in
          className={`inline-flex items-center rounded-full font-stencil font-extrabold uppercase ${hasPhoto ? "" : "mx-auto"}`}
          style={{
            ...delay(0),
            color: KIND_COLOR[a.kind],
            border: "2px solid currentColor",
            gap: u(0.8),
            padding: `${u(0.5)} ${u(1.4)}`,
            fontSize: u(1.8),
            letterSpacing: "0.1em",
          }}
        >
          <KindGlyph kind={a.kind} />
          {d.content.kinds[a.kind]}
          {a.teamName && <span className="text-ink-soft">· {a.teamName}</span>}
        </div>
        <h2 data-in className="font-display" style={{ ...delay(1), fontSize: u(a.title.length > 40 ? 6 : 7.6), lineHeight: 0.98, marginTop: u(2), letterSpacing: "-0.015em" }}>
          {a.title}
        </h2>
        {a.body && (
          <p data-in className="text-ink-soft" style={{ ...delay(2), fontSize: u(a.body.length > 160 ? 2.6 : 3.1), lineHeight: 1.3, marginTop: u(2.2) }}>
            {a.body}
          </p>
        )}
      </div>
      {hasPhoto && (
        <div data-in className="tv-card h-full" style={{ ...delay(2) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(a.mediaId!)} alt="" className="kenburns h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}

export function PhotoSlide({ p, d, mediaUrl, seconds }: { p: FeedPhoto; d: Dict; mediaUrl: (id: number) => string; seconds: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(p.id)}
        alt={p.caption}
        className="kenburns absolute inset-0 h-full w-full object-cover"
        style={{ "--kb-s": `${seconds + 2}s` } as React.CSSProperties}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, oklch(0.08 0 0 / 0.92), transparent 55%)" }} />
      <div className="absolute" style={{ left: u(3), right: u(3), bottom: u(3) }}>
        <div data-in className="tv-kicker" style={delay(1)}>
          {d.tv.photoKicker}
          {p.teamName ? ` · ${p.teamName}` : ""}
        </div>
        {p.caption && (
          <p data-in className="font-display" style={{ ...delay(2), fontSize: u(5.2), lineHeight: 1, marginTop: u(1) }}>
            {p.caption}
          </p>
        )}
      </div>
    </div>
  );
}

export function MessageSlide({ title, body, kicker }: { title: string; body?: string; kicker?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {kicker && (
        <div data-in className="tv-kicker" style={delay(0)}>
          {kicker}
        </div>
      )}
      <h2 data-in className="tv-title" style={{ ...delay(1), fontSize: u(6), marginTop: u(1.4) }}>
        {title}
      </h2>
      {body && (
        <p data-in className="text-ink-soft" style={{ ...delay(2), fontSize: u(2.4), marginTop: u(2), maxWidth: u(60) }}>
          {body}
        </p>
      )}
    </div>
  );
}
