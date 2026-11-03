"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { mapJobs, type Parsed } from "@/lib/job-map";
import { pct, ratio } from "@/lib/status";
import { readCsv, readXlsx } from "@/lib/xlsx";
import { useDict } from "../I18n";
import { IconSpark, IconUpload } from "../Icons";
import { send, toast } from "../client";
import { cx } from "../ui";

const CHUNK = 500;

export function ImportPanel({ aiReady }: { aiReady: boolean }) {
  const d = useDict();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reading" | "ready" | "uploading" | "writing">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function take(f: File) {
    setError(null);
    setParsed(null);
    setFile(f);
    setPhase("reading");
    try {
      const rows = /\.csv$/i.test(f.name) ? await readCsv(f) : await readXlsx(f);
      const p = mapJobs(rows);
      if (p.missing.length) {
        setError(d.data.missingCols(p.missing.join(", ")));
        setPhase("idle");
        return;
      }
      if (p.jobs.length === 0) {
        setError(d.errors.importEmpty);
        setPhase("idle");
        return;
      }
      setParsed(p);
      setYear(p.year);
      setPhase("ready");
    } catch {
      setError(d.data.readFailed);
      setPhase("idle");
    }
  }

  async function upload() {
    if (!parsed || !file) return;
    setPhase("uploading");
    setProgress(0);
    let importId: number | null = null;
    let created = 0;
    let updated = 0;
    const newTeams: string[] = [];
    try {
      for (let i = 0; i < parsed.jobs.length; i += CHUNK) {
        const res: { importId: number; created: number; updated: number; newTeams: string[] } = await send("/api/datos", "POST", {
          filename: file.name,
          year,
          importId,
          rows: parsed.jobs.slice(i, i + CHUNK),
        });
        importId = res.importId;
        created += res.created;
        updated += res.updated;
        newTeams.push(...res.newTeams);
        setProgress(Math.min(parsed.jobs.length, i + CHUNK));
      }
      toast(d.data.done(created, updated));
      if (newTeams.length) toast(d.data.newTeams(newTeams.join(", ")));

      // Resúmenes de la semana: no detienen nada si fallan.
      setPhase("writing");
      await send("/api/ai/insights", "POST").catch(() => {});
      setParsed(null);
      setFile(null);
      setPhase("idle");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPhase("ready");
    }
  }

  const busy = phase === "reading" || phase === "uploading" || phase === "writing";

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) take(f);
        }}
        className={cx(
          "panel lit group flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 text-center transition-colors",
          drag ? "border-red bg-red-wash" : "border-line-strong hover:border-ink-faint"
        )}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-red text-white shadow-[0_0_30px_oklch(0.56_0.21_26/0.5)] transition-transform group-hover:scale-105">
          <IconUpload size={26} />
        </span>
        <span className="font-display text-[1.9rem] leading-none">{phase === "reading" ? d.data.reading : d.data.drop}</span>
        <span className="text-sm text-ink-faint">{d.data.dropOr}</span>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) take(f);
            e.target.value = "";
          }}
        />
      </button>

      {error && (
        <p role="alert" className="rounded-xl bg-bad-wash px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}

      {parsed && file && (
        <div className="panel rise flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-medium">{file.name}</div>
              <div className="mt-0.5 text-sm text-ink-soft">
                {d.data.found(parsed.jobs.length, parsed.teams.length, parsed.weeks[0], parsed.weeks[1])}
              </div>
              {parsed.skipped > 0 && <div className="mt-0.5 text-xs text-ink-faint">{d.data.skipped(parsed.skipped)}</div>}
            </div>
            <div className="flex items-end gap-3">
              <label className="block">
                <span className="label">{d.data.year}</span>
                <input
                  type="number"
                  className="field w-28 font-mono"
                  value={year}
                  min={2015}
                  max={2100}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </label>
              <button type="button" className="btn btn-primary h-[2.9rem]" disabled={busy} onClick={upload}>
                {phase === "uploading"
                  ? d.data.uploading(progress, parsed.jobs.length)
                  : phase === "writing"
                    ? d.panel.regenerating
                    : d.data.upload}
              </button>
            </div>
          </div>

          {phase === "writing" && (
            <p className="flex items-center gap-2 text-sm text-red-text">
              <IconSpark size={16} />
              {aiReady ? d.data.writing : d.data.writingRules}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">{d.data.preview}</caption>
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-[0.06em] text-ink-faint">
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
                {parsed.jobs
                  .slice(-6)
                  .reverse()
                  .map((j) => (
                    <tr key={j.job} className="border-t border-line">
                      <td className="px-3 py-2">{j.week}</td>
                      <td className="px-3 py-2 font-mono">{j.job}</td>
                      <td className="px-3 py-2 font-mono">{j.team}</td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-ink-soft">{j.part}</td>
                      <td className="px-3 py-2 text-right">{j.units}</td>
                      <td className="px-3 py-2 text-right">{pct(ratio(j.passed, j.inspected))}</td>
                      <td className="px-3 py-2 text-right">{pct(ratio(j.est_hours, j.act_hours), 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
