"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PHOTO_BGS, type Media, type PhotoBg } from "@/lib/types";
import { useDict } from "../I18n";
import { IconTrash } from "../Icons";
import { send, toast } from "../client";
import { PhotoSlide } from "../tv/slides";
import { cx } from "../ui";
import { ScheduleFields, type Schedule } from "./ScheduleFields";
import { TvPreview } from "./TvPreview";

interface ScopeOption {
  id: number | null;
  label: string;
}

const SWATCH: Record<PhotoBg, string> = {
  black: "#050505",
  white: "#f4f4f2",
  red: "oklch(0.45 0.18 26)",
  blue: "#1d6f9a",
  blur: "linear-gradient(135deg, #3a4a5a, #1a1a1a 60%, #4a3a3a)",
};

const SECOND_PRESETS = [8, 15, 30];

/**
 * Todo lo de una foto en un solo lugar, con la lámina real de la tele como vista
 * previa: cómo se acomoda, qué parte queda al centro, fondo, movimiento, segundos,
 * en qué pantalla sale y cuándo.
 */
export function PhotoEditor({
  m,
  scopes,
  teamName,
  onDone,
}: {
  m: Media;
  scopes: ScopeOption[];
  teamName: string | null;
  onDone: () => void;
}) {
  const d = useDict();
  const router = useRouter();
  const [f, setF] = useState({
    caption: m.caption,
    fit: m.fit,
    pos_x: m.pos_x,
    pos_y: m.pos_y,
    bg: m.bg,
    motion: m.motion,
    seconds: m.seconds === null ? "" : String(m.seconds),
    in_rotation: m.in_rotation === 1,
    team_id: m.team_id,
  });
  const [schedule, setSchedule] = useState<Schedule>({ starts_at: m.starts_at ?? "", ends_at: m.ends_at ?? "" });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chip = (active: boolean) =>
    cx(
      "h-10 rounded-xl border px-3 text-sm font-medium transition-colors",
      active ? "border-red-text bg-red-wash text-ink" : "border-line bg-surface-2 text-ink-soft hover:text-ink"
    );

  async function save() {
    setBusy("save");
    setError(null);
    try {
      await send(`/api/media/${m.id}`, "PATCH", {
        caption: f.caption,
        fit: f.fit,
        pos_x: f.pos_x,
        pos_y: f.pos_y,
        bg: f.bg,
        motion: f.motion === 1,
        seconds: f.seconds === "" ? null : Number(f.seconds),
        in_rotation: f.in_rotation,
        team_id: f.team_id,
        starts_at: schedule.starts_at || null,
        ends_at: schedule.ends_at || null,
      });
      toast(d.content.saved);
      onDone();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await send(`/api/media/${m.id}`, "DELETE");
      toast(d.content.deleted);
      onDone();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const previewSeconds = f.seconds === "" ? 15 : Number(f.seconds) || 15;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="label">{d.content.previewTitle}</div>
        <TvPreview
          label={d.content.focusHint}
          onPick={(x, y) => setF({ ...f, pos_x: x, pos_y: y })}
          dot={{ x: f.pos_x, y: f.pos_y }}
        >
          <PhotoSlide
            key={`${f.fit}-${f.bg}-${f.motion}`}
            p={{ id: m.id, caption: f.caption, teamName: f.team_id === m.team_id ? teamName : null, fit: f.fit, pos_x: f.pos_x, pos_y: f.pos_y, bg: f.bg, motion: f.motion, seconds: null }}
            d={d}
            mediaUrl={(id) => `/api/media/${id}`}
            seconds={previewSeconds}
          />
        </TvPreview>
        <p className="mt-1.5 text-xs text-ink-faint">{d.content.focusHint}</p>
      </div>

      <div>
        <label className="label" htmlFor="ph-caption">{d.content.caption}</label>
        <input
          id="ph-caption"
          className="field"
          maxLength={140}
          placeholder={d.content.captionPlaceholder}
          value={f.caption}
          onChange={(e) => setF({ ...f, caption: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="label">{d.content.fit}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["cover", "contain"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={f.fit === v} className={chip(f.fit === v)} onClick={() => setF({ ...f, fit: v })}>
                {d.content.fits[v]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">{d.content.bg}</legend>
          <div className="flex flex-wrap gap-2">
            {PHOTO_BGS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={f.bg === v}
                title={d.content.bgs[v]}
                onClick={() => setF({ ...f, bg: v })}
                className={cx(
                  "flex h-10 items-center gap-2 rounded-xl border px-2.5 text-xs font-medium",
                  f.bg === v ? "border-red-text text-ink" : "border-line text-ink-soft hover:text-ink"
                )}
              >
                <span className="h-5 w-5 rounded-md border border-line-strong" style={{ background: SWATCH[v] }} />
                {d.content.bgs[v]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ph-seconds">{d.content.seconds}</label>
          <div className="flex gap-2">
            <input
              id="ph-seconds"
              type="number"
              min={5}
              max={300}
              className="field w-28"
              placeholder="—"
              value={f.seconds}
              onChange={(e) => setF({ ...f, seconds: e.target.value })}
            />
            {SECOND_PRESETS.map((s) => (
              <button key={s} type="button" className={chip(f.seconds === String(s))} onClick={() => setF({ ...f, seconds: String(s) })}>
                {s}s
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">{d.content.secondsHint}</p>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="accent-[var(--color-red)]"
              checked={f.motion === 1}
              onChange={(e) => setF({ ...f, motion: e.target.checked ? 1 : 0 })}
            />
            {d.content.motion}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="accent-[var(--color-red)]"
              checked={f.in_rotation}
              onChange={(e) => setF({ ...f, in_rotation: e.target.checked })}
            />
            {d.content.inRotation}
          </label>
          {scopes.length > 1 && (
            <div>
              <label className="label" htmlFor="ph-where">{d.content.where}</label>
              <select
                id="ph-where"
                className="field"
                value={f.team_id === null ? "" : String(f.team_id)}
                onChange={(e) => setF({ ...f, team_id: e.target.value === "" ? null : Number(e.target.value) })}
              >
                {scopes.map((s) => (
                  <option key={s.id ?? "plant"} value={s.id === null ? "" : String(s.id)}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <ScheduleFields value={schedule} onChange={setSchedule} idPrefix={`ph${m.id}`} />

      {error && <p role="alert" className="text-sm text-red-text">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {confirm ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">{d.common.confirmDelete}</span>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={busy !== null}>
              {busy === "delete" ? d.common.deleting : d.common.yes}
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>
            <IconTrash size={15} />
            {d.common.delete}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? d.common.saving : d.common.save}
        </button>
      </div>
    </div>
  );
}
