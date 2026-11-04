"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Display, Team } from "@/lib/types";
import type { LiveItem } from "@/lib/live";
import { SLIDE_KEYS, type SlideKey } from "@/lib/types";
import { formatLocal } from "@/lib/dates";
import { IconMegaphone, IconPhoto } from "../Icons";
import { useDict } from "../I18n";
import { IconPlay, IconTrash, IconTv } from "../Icons";
import { RelTime, send, toast } from "../client";
import { Empty, cx } from "../ui";

type Choice = { scope: "plant" | "team"; teamId: number | null };

function ScopeSelect({ value, onChange, teams, id }: { value: Choice; onChange: (c: Choice) => void; teams: Team[]; id: string }) {
  const d = useDict();
  return (
    <select
      id={id}
      className="field"
      value={value.scope === "plant" ? "plant" : String(value.teamId)}
      onChange={(e) =>
        onChange(e.target.value === "plant" ? { scope: "plant", teamId: null } : { scope: "team", teamId: Number(e.target.value) })
      }
    >
      <option value="plant">{d.displays.plant}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {d.displays.team(t.name)}
        </option>
      ))}
    </select>
  );
}

export function DisplaysManager({ displays, teams, live }: { displays: Display[]; teams: Team[]; live: Record<string, LiveItem[]> }) {
  const d = useDict();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<Choice>({ scope: "plant", teamId: null });
  const [lang, setLang] = useState<"en" | "es">("en");
  const [seconds, setSeconds] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  // Las teles conectadas se refrescan solas para ver quién está en línea.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send("/api/pantallas", "POST", { code, name, scope: choice.scope, teamId: choice.teamId, lang, seconds });
      toast(d.displays.connected);
      setCode("");
      setName("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const teamName = (id: number | null) => teams.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="flex flex-col gap-4">
        <form onSubmit={connect} className="panel lit flex flex-col gap-4 p-5">
          <h2 className="font-display text-[1.7rem] leading-none">{d.displays.howTitle}</h2>
          <ol className="flex flex-col gap-1.5 text-sm text-ink-soft">
            <li>
              1. {d.displays.how1} <span className="font-mono text-ink">{host}/tv</span>
            </li>
            <li>2. {d.displays.how2}</li>
            <li>3. {d.displays.how3}</li>
          </ol>
          <div>
            <label className="label" htmlFor="code">{d.displays.code}</label>
            <input
              id="code"
              className="field text-center font-board text-[2rem] font-extrabold uppercase tracking-[0.35em]"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123"
              autoComplete="off"
              autoCapitalize="characters"
              required
              minLength={6}
              maxLength={6}
            />
          </div>
          <div>
            <label className="label" htmlFor="dname">{d.displays.name}</label>
            <input id="dname" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={d.displays.namePlaceholder} maxLength={40} />
          </div>
          <div>
            <label className="label" htmlFor="scope">{d.displays.shows}</label>
            <ScopeSelect id="scope" value={choice} onChange={setChoice} teams={teams} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="lang">{d.displays.lang}</label>
              <select id="lang" className="field" value={lang} onChange={(e) => setLang(e.target.value === "es" ? "es" : "en")}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="secs">{d.displays.seconds}</label>
              <input id="secs" type="number" className="field" min={6} max={120} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-red-text">{error}</p>}
          <button type="submit" className="btn btn-primary h-11" disabled={busy || code.length !== 6}>
            {busy ? d.displays.connecting : d.displays.connect}
          </button>
        </form>

        <div className="panel p-5">
          <h2 className="text-[0.9375rem] font-semibold">{d.displays.links}</h2>
          <p className="mt-1 text-sm text-ink-faint">{d.displays.linksBody}</p>
          <div className="mt-3 flex flex-col gap-1.5">
            <Link href="/vista?back=/pantallas" className="btn btn-quiet btn-sm !justify-start">
              <IconPlay size={14} />
              {d.displays.plant}
            </Link>
            {teams.map((t) => (
              <Link key={t.id} href={`/vista?team=${t.id}&back=/pantallas`} className="btn btn-ghost btn-sm !justify-start">
                <IconPlay size={14} />
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-[0.9375rem] font-semibold">{d.displays.list}</h2>
        {displays.length === 0 ? (
          <Empty title={d.displays.none} />
        ) : (
          <ul className="grid gap-3">
            {displays.map((s) => (
              <DisplayCard key={s.id} s={s} teams={teams} teamName={teamName(s.team_id)} live={live[s.scope === "team" && s.team_id ? String(s.team_id) : "plant"] ?? []} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DisplayCard({ s, teams, teamName, live }: { s: Display; teams: Team[]; teamName: string; live: LiveItem[] }) {
  const d = useDict();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(s.name);
  const [choice, setChoice] = useState<Choice>({ scope: s.scope, teamId: s.team_id });
  const [lang, setLang] = useState(s.lang);
  const [seconds, setSeconds] = useState(s.slide_seconds);
  const [confirm, setConfirm] = useState(false);
  const [hidden, setHidden] = useState<SlideKey[]>(() => {
    try {
      const v = JSON.parse(s.hidden_slides || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const online = s.last_seen !== null && Date.now() - Date.parse(s.last_seen) < 15 * 60_000;

  async function save() {
    try {
      await send(`/api/pantallas/${s.id}`, "PATCH", { name, scope: choice.scope, teamId: choice.teamId, lang, seconds, hidden });
      toast(d.content.saved);
      setEdit(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  // Prender/apagar una lámina se guarda al instante, con la configuración guardada de la tele.
  async function toggle(k: SlideKey) {
    const next = hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k];
    setHidden(next);
    try {
      await send(`/api/pantallas/${s.id}`, "PATCH", {
        name: s.name,
        scope: s.scope,
        teamId: s.team_id,
        lang: s.lang,
        seconds: s.slide_seconds,
        hidden: next,
      });
      toast(d.displays.slidesSaved);
      router.refresh();
    } catch (e) {
      setHidden(hidden);
      toast((e as Error).message, "error");
    }
  }
  const shown = live.filter((it) => !hidden.includes(it.type === "news" ? "news" : "photos"));
  // "Trabajos" solo existe en pantallas de equipo.
  const keys = SLIDE_KEYS.filter((k) => k !== "jobs" || s.scope === "team");

  return (
    <li className="panel lit flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className={cx("grid h-10 w-10 flex-none place-items-center rounded-xl", online ? "bg-red-wash text-red-text" : "bg-surface-2 text-ink-faint")}>
          <IconTv size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{s.name || `#${s.id}`}</div>
          <div className="truncate text-xs text-ink-faint">
            {s.scope === "plant" ? d.displays.plant : d.displays.team(teamName)} · {s.lang.toUpperCase()} · {s.slide_seconds}s
          </div>
        </div>
        <span className={cx("flex flex-none items-center gap-1.5 text-xs", online ? "text-ink" : "text-ink-faint")}>
          {online && <span className="live-dot" />}
          {online ? d.displays.online : s.last_seen ? <span>{d.displays.offline("")}<RelTime iso={s.last_seen} /></span> : d.displays.never}
        </span>
      </div>

      <div>
        <div className="text-[0.7rem] font-medium uppercase tracking-[0.06em] text-ink-faint">{d.displays.slides}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {keys.map((k) => {
            const on = !hidden.includes(k);
            return (
              <button
                key={k}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(k)}
                className={cx(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  on ? "border-good/40 bg-good-wash text-ink" : "border-line text-ink-faint line-through decoration-ink-faint/60"
                )}
              >
                <span className={cx("h-2 w-2 rounded-full", on ? "bg-good" : "bg-ink-faint/50")} />
                {d.displays.slideNames[k]}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[0.7rem] text-ink-faint">{d.displays.slidesHint}</p>
      </div>

      <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
        <div className="text-[0.7rem] font-medium uppercase tracking-[0.06em] text-ink-faint">{d.displays.nowShowing}</div>
        {shown.length === 0 ? (
          <p className="mt-1 text-xs text-ink-faint">{d.displays.onlyMetrics}</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {shown.map((it) => (
              <li key={`${it.type}${it.id}`} className="flex items-center gap-2 text-xs">
                {it.type === "news" ? <IconMegaphone size={14} className="flex-none text-ink-faint" /> : <IconPhoto size={14} className="flex-none text-ink-faint" />}
                <span className="min-w-0 flex-1 truncate text-ink-soft">{it.label || (it.type === "photo" ? d.displays.photoNoCaption : "—")}</span>
                <span className="flex-none text-ink-faint">
                  {it.seconds ? `${it.seconds}s · ` : ""}
                  {it.ends_at ? d.displays.untilT(formatLocal(it.ends_at, d.locale)) : d.displays.noEndShort}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {edit ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label={d.displays.name} maxLength={40} />
          <ScopeSelect id={`scope-${s.id}`} value={choice} onChange={setChoice} teams={teams} />
          <div className="grid grid-cols-2 gap-3">
            <select className="field" aria-label={d.displays.lang} value={lang} onChange={(e) => setLang(e.target.value === "es" ? "es" : "en")}>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
            <input type="number" className="field" aria-label={d.displays.seconds} min={6} max={120} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>
              {d.common.cancel}
            </button>
            <button type="button" className="btn btn-light btn-sm" onClick={save}>
              {d.common.save}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/vista?display=${s.id}&back=/pantallas`}
            className="btn btn-quiet btn-sm"
          >
            <IconPlay size={14} />
            {d.displays.previewThis}
          </Link>
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>
              {d.common.edit}
            </button>
            {confirm ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                title={d.displays.removeConfirm}
                onClick={async () => {
                  try {
                    await send(`/api/pantallas/${s.id}`, "DELETE");
                    toast(d.displays.removed);
                    router.refresh();
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                {d.displays.remove}
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" aria-label={d.displays.remove} onClick={() => setConfirm(true)}>
                <IconTrash size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
