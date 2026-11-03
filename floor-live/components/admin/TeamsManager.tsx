"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Settings, Team } from "@/lib/types";
import { useDict } from "../I18n";
import { IconPlus } from "../Icons";
import { send, toast } from "../client";
import { Avatar, cx } from "../ui";

export interface AccountRow {
  id: number;
  username: string;
  name: string;
  role: "admin" | "leader";
  team_id: number | null;
  active: number;
  display_only: number;
}

export function TeamsTable({ teams }: { teams: Team[] }) {
  const d = useDict();
  if (teams.length === 0) return <p className="rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-ink-faint">{d.teams.noTeams}</p>;
  return (
    <div className="panel overflow-hidden">
      <div className="hidden grid-cols-[6rem_1fr_1fr_6rem_5rem] gap-3 border-b border-line bg-surface-2/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.06em] text-ink-faint md:grid">
        <span>{d.teams.code}</span>
        <span>{d.teams.name}</span>
        <span>{d.teams.leaderName}</span>
        <span>{d.teams.active}</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {teams.map((t) => (
          <TeamRow key={t.id} t={t} />
        ))}
      </ul>
    </div>
  );
}

function TeamRow({ t }: { t: Team }) {
  const d = useDict();
  const router = useRouter();
  const [name, setName] = useState(t.name);
  const [leader, setLeader] = useState(t.leader);
  const [active, setActive] = useState(t.active === 1);
  const [busy, setBusy] = useState(false);
  const dirty = name !== t.name || leader !== t.leader || active !== (t.active === 1);

  return (
    <li className="grid grid-cols-2 items-center gap-3 px-4 py-3 md:grid-cols-[6rem_1fr_1fr_6rem_5rem]">
      <span className="col-span-2 font-mono text-sm text-ink-soft md:col-span-1">{t.code}</span>
      <input className="field py-2" aria-label={d.teams.name} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <input className="field py-2" aria-label={d.teams.leaderName} value={leader} maxLength={60} placeholder={d.teams.leaderName} onChange={(e) => setLeader(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" className="accent-[var(--color-red)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {active ? d.teams.active : d.teams.inactive}
      </label>
      <button
        type="button"
        className={cx("btn btn-sm", dirty ? "btn-light" : "btn-ghost")}
        disabled={!dirty || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await send(`/api/equipos/${t.id}`, "PATCH", { name, leader, active });
            toast(d.teams.saved);
            router.refresh();
          } catch (e) {
            toast((e as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {d.common.save}
      </button>
    </li>
  );
}

export function AccountsManager({ accounts, teams, meId }: { accounts: AccountRow[]; teams: Team[]; meId: number }) {
  const d = useDict();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", role: "leader" as "leader" | "admin" | "screen", teamId: teams[0]?.id ?? 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ who: string; password: string } | null>(null);
  const teamName = (id: number | null) => teams.find((t) => t.id === id)?.name ?? "—";
  const label = (u: AccountRow) =>
    u.display_only
      ? d.teams.screenOf(u.team_id ? teamName(u.team_id) : d.common.wholePlant)
      : u.role === "admin"
        ? d.common.admin
        : `${d.common.leader} · ${teamName(u.team_id)}`;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Pantalla con teamId 0 = planta completa.
      const res: { password: string } = await send("/api/usuarios", "POST", { ...form, teamId: form.teamId || null });
      setSecret({ who: form.username, password: res.password });
      setForm({ ...form, name: "", username: "" });
      setOpen(false);
      toast(d.teams.created);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(u: AccountRow, action: "reset" | "deactivate" | "activate") {
    try {
      const res: { password?: string } = await send(`/api/usuarios/${u.id}`, "PATCH", { action });
      if (res.password) setSecret({ who: u.username, password: res.password });
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {secret && (
        <div className="panel rise border-red-text/40 p-4">
          <div className="text-sm text-ink-soft">
            {d.teams.tempPassword} · <span className="font-mono text-ink">{secret.who}</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <code className="font-board text-[2rem] font-extrabold tracking-[0.06em] text-ink">{secret.password}</code>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => navigator.clipboard?.writeText(secret.password).then(() => toast(d.common.copied))}
            >
              {d.common.copy}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-faint">{d.teams.tempPasswordHint}</p>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setSecret(null)}>
            {d.common.close}
          </button>
        </div>
      )}

      <ul className="panel divide-y divide-line">
        {accounts.map((u) => (
          <AccountItem key={u.id} u={u} teams={teams} meId={meId} onAct={act} label={label(u)} />
        ))}
      </ul>

      {open ? (
        <form onSubmit={create} className="panel rise grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pname">{d.teams.personName}</label>
            <input id="pname" className="field" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="uname">{d.auth.username}</label>
            <input
              id="uname"
              className="field font-mono"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-z0-9_]+"
              autoCapitalize="none"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
            />
          </div>
          <div>
            <label className="label" htmlFor="role">{d.teams.role}</label>
            <select
              id="role"
              className="field"
              value={form.role}
              onChange={(e) => {
                const role = e.target.value === "admin" ? "admin" : e.target.value === "screen" ? "screen" : "leader";
                // Una pantalla nueva arranca mostrando la planta completa.
                setForm({ ...form, role, teamId: role === "screen" ? 0 : form.teamId || teams[0]?.id || 0 });
              }}
            >
              <option value="leader">{d.common.leader}</option>
              <option value="screen">{d.common.screenAccount}</option>
              <option value="admin">{d.common.admin}</option>
            </select>
          </div>
          {form.role === "screen" && (
            <div>
              <label className="label" htmlFor="shows">{d.teams.shows}</label>
              <select id="shows" className="field" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: Number(e.target.value) })}>
                <option value={0}>{d.common.wholePlant}</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.role === "screen" && <p className="text-xs text-ink-faint sm:col-span-2">{d.teams.screenHint}</p>}
          {form.role === "leader" && (
            <div>
              <label className="label" htmlFor="team">{d.teams.team}</label>
              <select id="team" className="field" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: Number(e.target.value) })}>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-text sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              {d.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? d.common.saving : d.teams.create}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-quiet self-start" onClick={() => setOpen(true)} disabled={teams.length === 0}>
          <IconPlus size={16} />
          {d.teams.newAccount}
        </button>
      )}
    </div>
  );
}

/** Una cuenta en la lista; "Editar" abre nombre, permiso y equipo en el mismo renglón. */
function AccountItem({
  u,
  teams,
  meId,
  onAct,
  label,
}: {
  u: AccountRow;
  teams: Team[];
  meId: number;
  onAct: (u: AccountRow, action: "reset" | "deactivate" | "activate") => void;
  label: string;
}) {
  const d = useDict();
  const router = useRouter();
  const kindOf = (x: AccountRow): "admin" | "leader" | "screen" => (x.display_only ? "screen" : x.role === "admin" ? "admin" : "leader");
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: u.name, role: kindOf(u), teamId: u.team_id ?? 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/usuarios/${u.id}`, "PATCH", { action: "update", name: f.name, role: f.role, teamId: f.teamId || null });
      toast(d.content.saved);
      setEdit(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cx("flex flex-col gap-3 px-4 py-3", !u.active && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={u.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {u.name} {u.id === meId && <span className="text-ink-faint">({d.teams.you})</span>}
          </div>
          <div className="truncate text-xs text-ink-faint">
            <span className="font-mono">{u.username}</span> · {label}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit((x) => !x)}>
            {d.common.edit}
          </button>
          {u.id !== meId && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(u, "reset")}>
                {d.teams.resetPassword}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(u, u.active ? "deactivate" : "activate")}>
                {u.active ? d.teams.deactivate : d.teams.reactivate}
              </button>
            </>
          )}
        </div>
      </div>
      {edit && (
        <div className="grid gap-3 rounded-xl bg-surface-2/60 p-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor={`n${u.id}`}>{d.teams.personName}</label>
            <input id={`n${u.id}`} className="field" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor={`r${u.id}`}>{d.teams.role}</label>
            <select
              id={`r${u.id}`}
              className="field"
              value={f.role}
              disabled={u.id === meId}
              onChange={(e) => {
                const role = e.target.value === "admin" ? "admin" : e.target.value === "screen" ? "screen" : "leader";
                setF({ ...f, role, teamId: role === "leader" ? f.teamId || teams[0]?.id || 0 : role === "admin" ? 0 : f.teamId });
              }}
            >
              <option value="leader">{d.common.leader}</option>
              <option value="screen">{d.common.screenAccount}</option>
              <option value="admin">{d.common.admin}</option>
            </select>
          </div>
          {f.role !== "admin" && (
            <div>
              <label className="label" htmlFor={`t${u.id}`}>{f.role === "screen" ? d.teams.shows : d.teams.team}</label>
              <select id={`t${u.id}`} className="field" value={f.teamId} onChange={(e) => setF({ ...f, teamId: Number(e.target.value) })}>
                {f.role === "screen" && <option value={0}>{d.common.wholePlant}</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-text sm:col-span-3">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>
              {d.common.cancel}
            </button>
            <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={save}>
              {busy ? d.common.saving : d.common.save}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const d = useDict();
  const router = useRouter();
  const [s, setS] = useState({
    plantName: settings.plantName,
    goalFpy: String(settings.goalFpy),
    goalEff: String(settings.goalEff),
    warnFpy: String(settings.warnFpy),
    warnEff: String(settings.warnEff),
    safetySince: settings.safetySince ?? "",
    safetyRecord: String(settings.safetyRecord),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (k: keyof typeof s, label: string, type = "number", extra: Record<string, unknown> = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} type={type} className="field" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <form
      className="panel grid gap-4 p-5 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await send("/api/ajustes", "PATCH", s);
          toast(d.teams.settingsSaved);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {field("plantName", d.teams.plantName, "text", { maxLength: 40 })}
      <div className="hidden sm:block" />
      {field("goalFpy", d.teams.goalFpy, "number", { min: 50, max: 100, step: 0.1 })}
      {field("goalEff", d.teams.goalEff, "number", { min: 50, max: 200, step: 1 })}
      {field("warnFpy", d.teams.warnFpy, "number", { min: 0, max: 50, step: 0.5 })}
      {field("warnEff", d.teams.warnEff, "number", { min: 0, max: 100, step: 1 })}
      {field("safetySince", d.teams.safetySince, "date")}
      {field("safetyRecord", d.teams.safetyRecord, "number", { min: 0, max: 100000, step: 1 })}
      {error && <p role="alert" className="text-sm text-red-text sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-light" disabled={busy}>
          {busy ? d.common.saving : d.common.save}
        </button>
      </div>
    </form>
  );
}
