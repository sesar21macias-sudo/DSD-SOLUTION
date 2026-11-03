"use client";

import { addMinutes, formatLocal, nowInTz, scheduleState, type ScheduleState } from "@/lib/dates";
import { useDict } from "../I18n";
import { cx } from "../ui";

export interface Schedule {
  starts_at: string;
  ends_at: string;
}

/**
 * "Aparece" y "Se quita" con fecha y hora de planta, más atajos de un toque.
 * Los valores son "YYYY-MM-DDTHH:MM" (lo que da <input type="datetime-local">);
 * vacío = sin límite. La tele revisa cada minuto, así que entra y sale a tiempo.
 */
export function ScheduleFields({ value, onChange, idPrefix }: { value: Schedule; onChange: (s: Schedule) => void; idPrefix: string }) {
  const d = useDict();

  const preset = (kind: "today" | "shift" | "tomorrow" | "week") => {
    const now = nowInTz();
    const start = value.starts_at && value.starts_at > now ? value.starts_at : now;
    const day = start.slice(0, 10);
    const ends = {
      today: `${day}T23:59`,
      shift: addMinutes(start, 8 * 60),
      tomorrow: `${addMinutes(`${day}T00:00`, 24 * 60).slice(0, 10)}T23:59`,
      week: addMinutes(start, 7 * 24 * 60),
    }[kind];
    onChange({ starts_at: value.starts_at && value.starts_at > now ? value.starts_at : "", ends_at: ends });
  };

  const chip = "h-8 rounded-full border border-line bg-surface-2 px-3 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink";

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <legend className="px-1 text-[0.8125rem] font-medium text-ink-soft">{d.content.scheduleTitle}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-start`}>{d.content.startsAt}</label>
          <div className="flex gap-2">
            <input
              id={`${idPrefix}-start`}
              type="datetime-local"
              className="field"
              value={value.starts_at}
              onChange={(e) => onChange({ ...value, starts_at: e.target.value })}
            />
            {value.starts_at && (
              <button type="button" className={chip} onClick={() => onChange({ ...value, starts_at: "" })}>
                {d.content.now}
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-end`}>{d.content.endsAt}</label>
          <div className="flex gap-2">
            <input
              id={`${idPrefix}-end`}
              type="datetime-local"
              className="field"
              value={value.ends_at}
              min={value.starts_at || undefined}
              onChange={(e) => onChange({ ...value, ends_at: e.target.value })}
            />
            {value.ends_at && (
              <button type="button" className={chip} onClick={() => onChange({ ...value, ends_at: "" })}>
                {d.content.noEnd}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["today", "shift", "tomorrow", "week"] as const).map((k) => (
          <button key={k} type="button" className={chip} onClick={() => preset(k)}>
            {d.content.presets[k]}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-faint">{d.content.datesHint}</p>
    </fieldset>
  );
}

/** Píldora de estado: en pantalla / programado / terminó (u oculta). */
export function ScheduleBadge({ startsAt, endsAt, hidden }: { startsAt: string | null; endsAt: string | null; hidden?: boolean }) {
  const d = useDict();
  const st: ScheduleState = scheduleState(startsAt, endsAt);
  if (hidden) return <span className="chip-none rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">{d.content.hidden}</span>;
  return (
    <span
      className={cx(
        "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
        st === "live" ? "chip-good" : st === "scheduled" ? "chip-warn" : "chip-none"
      )}
    >
      {d.content.status[st]}
    </span>
  );
}

/** "Aparece nov 3, 7:00 a.m. · Se quita nov 4, 6:00 p.m." o solo lo que aplique. */
export function ScheduleText({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  const d = useDict();
  const now = nowInTz();
  const parts: string[] = [];
  if (startsAt && startsAt > now) parts.push(d.content.startsOn(formatLocal(startsAt, d.locale)));
  if (endsAt) parts.push(d.content.endsOn(formatLocal(endsAt, d.locale)));
  if (!parts.length) return null;
  return <span>{parts.join(" · ")}</span>;
}
