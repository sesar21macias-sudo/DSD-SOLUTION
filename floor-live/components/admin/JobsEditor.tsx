"use client";

import { useCallback, useEffect, useState } from "react";
import { pct, ratio, toneFor } from "@/lib/status";
import { DEFECTS, type Team } from "@/lib/types";
import { DEFECT_NAMES } from "@/lib/summary";
import { useDict, useLang } from "../I18n";
import { IconPlus, IconTrash } from "../Icons";
import { RelTime, send, toast } from "../client";
import { Sheet } from "../Sheet";
import { ToneGlyph } from "../tv/glyphs";
import { cx } from "../ui";

interface JobRecord {
  id: number;
  year: number;
  week: number;
  job: string;
  team_code: string;
  part: string;
  units: number;
  inspected: number;
  rejected: number;
  passed: number;
  est_hours: number;
  act_hours: number;
  rework_hours: number;
  closed_on: string | null;
  import_id: number | null;
  [k: `d_${string}`]: number;
}

interface LogRow {
  id: number;
  job: string;
  action: "create" | "update" | "delete";
  summary: string;
  created_at: string;
  who: string | null;
}

interface Goals {
  goalFpy: number;
  goalEff: number;
  warnFpy: number;
  warnEff: number;
}

/**
 * Buscar, corregir, agregar y borrar trabajos sin volver a subir el Excel.
 * Calidad y eficiencia se recalculan mientras se escribe.
 */
export function JobsEditor({ teams, goals }: { teams: Team[]; goals: Goals }) {
  const d = useDict();
  const [filters, setFilters] = useState({ week: "", team: "", q: "" });
  const [data, setData] = useState<{ year: number; rows: JobRecord[]; weeks: number[]; log: LogRow[] } | null>(null);
  const [editing, setEditing] = useState<JobRecord | "new" | null>(null);
  const teamName = (code: string) => teams.find((t) => t.code === code)?.name ?? code;

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filters.week) qs.set("week", filters.week);
    if (filters.team) qs.set("team", filters.team);
    if (filters.q) qs.set("q", filters.q);
    try {
      const res = await fetch(`/api/trabajos?${qs}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* sin red: se queda lo último */
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  // Al abrir, la semana más reciente (la que se ve en las pantallas).
  useEffect(() => {
    if (data && !filters.week && !filters.team && !filters.q && data.weeks[0] && data.rows.length >= 300) {
      setFilters((f) => ({ ...f, week: String(data.weeks[0]) }));
    }
  }, [data, filters]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.9rem] leading-none">{d.data.jobsTitle}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{d.data.jobsSubtitle}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
          <IconPlus size={16} />
          {d.data.addJob}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_12rem_12rem]">
        <input
          className="field"
          type="search"
          placeholder={d.data.search}
          aria-label={d.data.search}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select className="field" aria-label={d.data.fWeek} value={filters.week} onChange={(e) => setFilters({ ...filters, week: e.target.value })}>
          <option value="">{d.data.allWeeks}</option>
          {data?.weeks.map((w) => (
            <option key={w} value={w}>
              {d.common.week(w)}
            </option>
          ))}
        </select>
        <select className="field" aria-label={d.data.fTeam} value={filters.team} onChange={(e) => setFilters({ ...filters, team: e.target.value })}>
          <option value="">{d.data.allTeams}</option>
          {teams.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="panel overflow-hidden">
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-2 text-left text-xs uppercase tracking-[0.06em] text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">{d.data.colWeek}</th>
                <th className="px-3 py-2 font-medium">{d.data.colJob}</th>
                <th className="px-3 py-2 font-medium">{d.data.colTeam}</th>
                <th className="px-3 py-2 font-medium">{d.data.colPart}</th>
                <th className="px-3 py-2 text-right font-medium">{d.data.colUnits}</th>
                <th className="px-3 py-2 text-right font-medium">{d.data.colFpy}</th>
                <th className="px-3 py-2 text-right font-medium">{d.data.colEff}</th>
              </tr>
            </thead>
            <tbody className="num">
              {data?.rows.map((r) => {
                const fpy = ratio(r.passed, r.inspected);
                const eff = ratio(r.est_hours, r.act_hours);
                const qt = toneFor(fpy === null ? null : fpy * 100, goals.goalFpy, goals.warnFpy);
                const et = toneFor(eff === null ? null : eff * 100, goals.goalEff, goals.warnEff);
                return (
                  <tr key={r.id} className="cursor-pointer border-t border-line hover:bg-surface-2/60" onClick={() => setEditing(r)}>
                    <td className="px-3 py-2">{r.week}</td>
                    <td className="px-3 py-2 font-mono">
                      {r.job}
                      {r.import_id === null && <span className="ml-1.5 rounded-full bg-warn-wash px-1.5 text-[0.65rem] text-warn">{d.data.manual}</span>}
                    </td>
                    <td className="px-3 py-2">{teamName(r.team_code)}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-ink-soft">{r.part}</td>
                    <td className="px-3 py-2 text-right">{r.units}</td>
                    <td className={`px-3 py-2 text-right tone-${qt}`}>{pct(fpy)}</td>
                    <td className={`px-3 py-2 text-right tone-${et}`}>{pct(eff, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && data.rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-faint">{d.data.noJobs}</p>}
        </div>
        {data && data.rows.length > 0 && <div className="border-t border-line px-3 py-2 text-xs text-ink-faint">{d.data.showing(data.rows.length)}</div>}
      </div>

      <div className="panel p-4">
        <h3 className="text-sm font-semibold">{d.data.recentEdits}</h3>
        {!data?.log.length ? (
          <p className="mt-1 text-sm text-ink-faint">{d.data.noEdits}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-xs">
            {data.log.map((l) => (
              <li key={l.id} className="text-ink-soft">
                <span className="text-ink">{l.who ?? "—"}</span> {d.data.actions[l.action]} <span className="font-mono text-ink">{l.job}</span>
                {l.summary && <span className="text-ink-faint"> · {l.summary}</span>} · <RelTime iso={l.created_at} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? d.data.newJob : d.data.editJob} wide>
        {editing !== null && data && (
          <JobForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            year={data.year}
            defaultWeek={Number(filters.week) || data.weeks[0] || 1}
            teams={teams}
            goals={goals}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Sheet>
    </section>
  );
}

function JobForm({
  initial,
  year,
  defaultWeek,
  teams,
  goals,
  onDone,
}: {
  initial: JobRecord | null;
  year: number;
  defaultWeek: number;
  teams: Team[];
  goals: Goals;
  onDone: () => void;
}) {
  const d = useDict();
  const lang = useLang();
  const [f, setF] = useState({
    job: initial?.job ?? "",
    week: String(initial?.week ?? defaultWeek),
    team: initial?.team_code ?? teams[0]?.code ?? "",
    part: initial?.part ?? "",
    units: String(initial?.units ?? ""),
    inspected: String(initial?.inspected ?? ""),
    passed: String(initial?.passed ?? ""),
    rejected: String(initial?.rejected ?? ""),
    est_hours: String(initial?.est_hours ?? ""),
    act_hours: String(initial?.act_hours ?? ""),
    rework_hours: String(initial?.rework_hours ?? "0"),
    closed_on: initial?.closed_on ?? "",
  });
  const [defects, setDefects] = useState<Record<string, string>>(
    Object.fromEntries(DEFECTS.map((k) => [k, String(initial?.[`d_${k}`] ?? 0)]))
  );
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = (v: string) => (v === "" ? 0 : Number(v));
  const fpy = ratio(n(f.passed), n(f.inspected));
  const eff = ratio(n(f.est_hours), n(f.act_hours));
  const qt = toneFor(fpy === null ? null : fpy * 100, goals.goalFpy, goals.warnFpy);
  const et = toneFor(eff === null ? null : eff * 100, goals.goalEff, goals.warnEff);

  const field = (k: keyof typeof f, label: string, type = "number", extra: Record<string, unknown> = {}) => (
    <div>
      <label className="label" htmlFor={`job-${k}`}>{label}</label>
      <input
        id={`job-${k}`}
        type={type}
        className="field"
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        {...(type === "number" ? { min: 0, step: "any" } : {})}
        {...extra}
      />
    </div>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    const payload = {
      year,
      job: f.job,
      week: n(f.week),
      team: f.team,
      part: f.part,
      units: n(f.units),
      inspected: n(f.inspected),
      passed: n(f.passed),
      rejected: f.rejected === "" ? Math.max(0, n(f.inspected) - n(f.passed)) : n(f.rejected),
      est_hours: n(f.est_hours),
      act_hours: n(f.act_hours),
      rework_hours: n(f.rework_hours),
      closed_on: f.closed_on || null,
      defects: Object.fromEntries(DEFECTS.map((k) => [k, n(defects[k])])),
    };
    try {
      if (initial) await send(`/api/trabajos/${initial.id}`, "PATCH", payload);
      else await send("/api/trabajos", "POST", payload);
      toast(d.data.jobSaved);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!initial) return;
    setBusy("delete");
    try {
      await send(`/api/trabajos/${initial.id}`, "DELETE");
      toast(d.data.jobDeleted);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2/60 p-3">
        <div className={`tone-${qt}`}>
          <div className="text-xs uppercase tracking-[0.06em] text-ink-faint">{d.common.quality}</div>
          <div className="flex items-center gap-2 font-board text-[2rem] font-extrabold leading-none">
            <ToneGlyph tone={qt} />
            {pct(fpy)}
          </div>
        </div>
        <div className={`tone-${et}`}>
          <div className="text-xs uppercase tracking-[0.06em] text-ink-faint">{d.common.efficiency}</div>
          <div className="flex items-center gap-2 font-board text-[2rem] font-extrabold leading-none">
            <ToneGlyph tone={et} />
            {pct(eff, 0)}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {field("job", d.data.fJob, "text", { required: true, maxLength: 40, className: "field font-mono" })}
        {field("week", d.data.fWeek, "number", { required: true, min: 1, max: 53, step: 1 })}
        <div>
          <label className="label" htmlFor="job-team">{d.data.fTeam}</label>
          <select id="job-team" className="field" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>
            {teams.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
        </div>
        {field("closed_on", d.data.fClosed, "date")}
      </div>

      {field("part", d.data.fPart, "text", { maxLength: 80 })}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("units", d.data.fUnits)}
        {field("inspected", d.data.fInspected)}
        {field("passed", d.data.fPassed)}
        {field("rejected", d.data.fRejected)}
        {field("est_hours", d.data.fEst)}
        {field("act_hours", d.data.fAct)}
        {field("rework_hours", d.data.fRework)}
      </div>

      <fieldset>
        <legend className="label">{d.data.fDefects}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DEFECTS.map((k) => (
            <div key={k}>
              <label className="mb-1 block text-xs text-ink-faint" htmlFor={`def-${k}`}>
                {DEFECT_NAMES[lang][k]}
              </label>
              <input
                id={`def-${k}`}
                type="number"
                min={0}
                className="field !py-2"
                value={defects[k]}
                onChange={(e) => setDefects({ ...defects, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-text">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {initial ? (
          confirm ? (
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
          )
        ) : (
          <span />
        )}
        <button type="submit" className={cx("btn btn-primary")} disabled={busy !== null}>
          {busy === "save" ? d.common.saving : d.common.save}
        </button>
      </div>
    </form>
  );
}
