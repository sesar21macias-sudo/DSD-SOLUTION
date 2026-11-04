"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { preparePhoto } from "@/lib/compress";
import { ACCENTS, ANNOUNCEMENT_KINDS, TEMPLATES, type Accent, type Announcement, type AnnouncementKind, type Media, type Template } from "@/lib/types";
import { useDict, useLang } from "../I18n";
import { IconCamera, IconEdit, IconPlus, IconSpark, IconTrash } from "../Icons";
import { Sheet } from "../Sheet";
import { send, toast } from "../client";
import { KindGlyph } from "../tv/glyphs";
import { ScheduleBadge, ScheduleFields, ScheduleText, type Schedule } from "./ScheduleFields";
import { PhotoEditor } from "./PhotoEditor";
import { TvPreview } from "./TvPreview";
import { AnnouncementSlide, PhotoFrame } from "../tv/slides";
import { Empty, cx } from "../ui";

interface ScopeOption {
  id: number | null;
  label: string;
}

const ACCENT_SWATCH: Record<Accent, string> = {
  auto: "conic-gradient(var(--color-ink), var(--color-warn), var(--color-good), var(--color-red), var(--color-ink))",
  red: "var(--color-red)",
  blue: "#28a8e0",
  green: "var(--color-good)",
  amber: "var(--color-warn)",
  white: "var(--color-ink)",
};

/** Dibujito de cada plantilla para el selector (bloques, no texto). */
function TemplateIcon({ t }: { t: Template }) {
  const box = "relative block h-10 w-full overflow-hidden rounded-md bg-black/60";
  const bar = "absolute rounded-sm bg-ink/80";
  const acc = "absolute rounded-sm bg-red";
  if (t === "banner")
    return (
      <span className={box}>
        <span className={acc} style={{ left: "8%", right: "8%", top: "12%", height: "22%" }} />
        <span className={bar} style={{ left: "20%", right: "20%", top: "50%", height: "14%" }} />
        <span className={bar} style={{ left: "30%", right: "30%", top: "72%", height: "8%", opacity: 0.5 }} />
      </span>
    );
  if (t === "split")
    return (
      <span className={box}>
        <span className={acc} style={{ left: "6%", width: "38%", top: "12%", bottom: "12%" }} />
        <span className={bar} style={{ left: "52%", right: "8%", top: "36%", height: "14%" }} />
        <span className={bar} style={{ left: "52%", right: "20%", top: "58%", height: "8%", opacity: 0.5 }} />
      </span>
    );
  if (t === "spotlight")
    return (
      <span className={box} style={{ background: "linear-gradient(135deg, #5b6b7b, #2b2b2b)" }}>
        <span className={acc} style={{ left: "8%", width: "14%", bottom: "38%", height: "6%" }} />
        <span className={bar} style={{ left: "8%", width: "50%", bottom: "16%", height: "14%" }} />
      </span>
    );
  if (t === "celebrate")
    return (
      <span className={box}>
        <span className="absolute left-1/2 top-1/2 h-8 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warn/30 blur-md" />
        <span className="absolute rounded-sm bg-warn" style={{ left: "22%", right: "22%", top: "40%", height: "16%" }} />
        <span className={bar} style={{ left: "32%", right: "32%", top: "66%", height: "8%", opacity: 0.5 }} />
      </span>
    );
  return (
    <span className={box}>
      <span className="absolute rounded-full border border-ink/70" style={{ left: "8%", width: "26%", top: "18%", height: "14%" }} />
      <span className={bar} style={{ left: "8%", width: "44%", top: "42%", height: "14%" }} />
      <span className={bar} style={{ left: "8%", width: "38%", top: "64%", height: "8%", opacity: 0.5 }} />
      <span className="absolute rounded-sm bg-ink/30" style={{ right: "8%", width: "34%", top: "14%", bottom: "14%" }} />
    </span>
  );
}

const KIND_TONE: Record<AnnouncementKind, string> = {
  news: "text-ink",
  celebration: "tone-warn",
  safety: "tone-good",
  reminder: "text-red-text",
};

export function ContentManager({
  announcements,
  media,
  scopes,
  teamNames,
  aiReady,
}: {
  announcements: Announcement[];
  media: Media[];
  scopes: ScopeOption[];
  teamNames: Record<number, string>;
  aiReady: boolean;
}) {
  const d = useDict();
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const where = (teamId: number | null) => (teamId === null ? d.common.wholePlant : teamNames[teamId] ?? "—");

  return (
    <div className="grid gap-8 xl:grid-cols-[1.3fr_1fr]">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[0.9375rem] font-semibold">{d.content.announcements}</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            <IconPlus size={16} />
            {d.content.newAnnouncement}
          </button>
        </div>
        {announcements.length === 0 ? (
          <Empty title={d.content.noAnnouncements}>{d.content.noAnnouncementsBody}</Empty>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {announcements.map((a, k) => {
              const title = a.title_es || a.title_en || a.body_es || a.body_en;
              const body = a.title_es || a.title_en ? a.body_es || a.body_en : "";
              return (
                <li key={a.id} className="panel lit rise flex gap-3 p-4" style={{ animationDelay: `${k * 30}ms` }}>
                  <span className={cx("mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-2 text-lg", KIND_TONE[a.kind])}>
                    <KindGlyph kind={a.kind} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                      <ScheduleBadge startsAt={a.starts_at} endsAt={a.ends_at} />
                      <span>{d.content.kinds[a.kind]}</span>·<span>{where(a.team_id)}</span>
                      <ScheduleText startsAt={a.starts_at} endsAt={a.ends_at} />
                    </div>
                    <div className="mt-1 font-medium">{title}</div>
                    {body && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{body}</p>}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setEditing(a)} aria-label={d.common.edit}>
                    <IconEdit size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PhotoSection media={media} scopes={scopes} where={where} />

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? d.content.newAnnouncement : d.content.editAnnouncement}
        wide
      >
        {editing !== null && (
          <AnnouncementForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            scopes={scopes}
            media={media}
            aiReady={aiReady}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

function AnnouncementForm({
  initial,
  scopes,
  media,
  aiReady,
  onDone,
}: {
  initial: Announcement | null;
  scopes: ScopeOption[];
  media: Media[];
  aiReady: boolean;
  onDone: () => void;
}) {
  const d = useDict();
  const lang = useLang();
  const router = useRouter();
  const [teamId, setTeamId] = useState<number | null>(initial ? initial.team_id : scopes[0]?.id ?? null);
  const [kind, setKind] = useState<AnnouncementKind>(initial?.kind ?? "news");
  const [f, setF] = useState({
    title_es: initial?.title_es ?? "",
    body_es: initial?.body_es ?? "",
    title_en: initial?.title_en ?? "",
    body_en: initial?.body_en ?? "",
  });
  const [schedule, setSchedule] = useState<Schedule>({ starts_at: initial?.starts_at ?? "", ends_at: initial?.ends_at ?? "" });
  const [mediaId, setMediaId] = useState<number | null>(initial?.media_id ?? null);
  const [template, setTemplate] = useState<Template>(initial?.template ?? "classic");
  const [accent, setAccent] = useState<Accent>(initial?.accent ?? "auto");
  const [seconds, setSeconds] = useState(initial?.seconds ? String(initial.seconds) : "");
  const [busy, setBusy] = useState<"save" | "polish" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const usable = media.filter((m) => m.team_id === null || m.team_id === teamId);

  async function polish() {
    const title = f.title_es || f.title_en;
    const body = f.body_es || f.body_en;
    if (!title && !body) return setError(d.errors.textRequired);
    setBusy("polish");
    setError(null);
    try {
      const res: { ok: boolean; unavailable?: boolean; title_en?: string; body_en?: string; title_es?: string; body_es?: string } =
        await send("/api/ai/announce", "POST", { title, body });
      if (!res.ok) {
        setError(d.content.polishUnavailable);
        return;
      }
      setF({ ...f, title_en: res.title_en ?? "", body_en: res.body_en ?? "", title_es: res.title_es ?? "", body_es: res.body_es ?? "" });
      toast(d.content.polished);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const payload = {
        ...f,
        kind,
        media_id: mediaId,
        team_id: teamId,
        starts_at: schedule.starts_at || null,
        ends_at: schedule.ends_at || null,
        template,
        accent,
        seconds: seconds === "" ? null : Number(seconds),
      };
      if (initial) await send(`/api/anuncios/${initial.id}`, "PATCH", payload);
      else await send("/api/anuncios", "POST", payload);
      toast(d.content.saved);
      onDone();
      router.refresh();
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
      await send(`/api/anuncios/${initial.id}`, "DELETE");
      toast(d.content.deleted);
      onDone();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {scopes.length > 1 && (
        <div>
          <label className="label" htmlFor="where">{d.content.where}</label>
          <select
            id="where"
            className="field"
            value={teamId === null ? "" : String(teamId)}
            onChange={(e) => setTeamId(e.target.value === "" ? null : Number(e.target.value))}
          >
            {scopes.map((s) => (
              <option key={s.id ?? "plant"} value={s.id === null ? "" : String(s.id)}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset>
        <legend className="label">{d.content.kind}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ANNOUNCEMENT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cx(
                "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
                kind === k ? "border-red-text bg-red-wash text-ink" : "border-line bg-surface-2 text-ink-soft hover:text-ink"
              )}
            >
              <span className={KIND_TONE[k]}>
                <KindGlyph kind={k} />
              </span>
              {d.content.kinds[k]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="label">{d.content.previewTitle}</div>
        <TvPreview>
          <AnnouncementSlide
            key={`${template}-${accent}-${kind}-${mediaId}`}
            a={{
              id: initial?.id ?? 0,
              kind,
              title: (lang === "en" ? f.title_en || f.title_es : f.title_es || f.title_en) || d.content.design,
              body: lang === "en" ? f.body_en || f.body_es : f.body_es || f.body_en,
              mediaId,
              look: mediaId ? media.find((m) => m.id === mediaId) ?? null : null,
              teamName: null,
              template,
              accent,
              seconds: null,
            }}
            d={d}
            mediaUrl={(id) => `/api/media/${id}`}
          />
        </TvPreview>
      </div>

      <fieldset>
        <legend className="label">{d.content.design}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={template === t}
              onClick={() => setTemplate(t)}
              className={cx(
                "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs font-medium transition-colors",
                template === t ? "border-red-text bg-red-wash text-ink" : "border-line bg-surface-2 text-ink-soft hover:text-ink"
              )}
            >
              <TemplateIcon t={t} />
              {d.content.templates[t]}
            </button>
          ))}
        </div>
        {template === "spotlight" && mediaId === null && <p className="mt-1.5 text-xs text-ink-faint">{d.content.spotlightNeedsPhoto}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <fieldset>
          <legend className="label">{d.content.accent}</legend>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={accent === c}
                onClick={() => setAccent(c)}
                className={cx(
                  "flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium",
                  accent === c ? "border-red-text text-ink" : "border-line text-ink-soft hover:text-ink"
                )}
              >
                <span className="h-4 w-4 rounded-full border border-line-strong" style={{ background: ACCENT_SWATCH[c] }} />
                {d.content.accents[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="ann-seconds">{d.content.seconds}</label>
          <input
            id="ann-seconds"
            type="number"
            min={5}
            max={300}
            placeholder="—"
            className="field w-28"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-ink-faint">{d.content.secondsHint}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="title_es">{d.content.titleEs}</label>
            <input id="title_es" className="field" maxLength={80} value={f.title_es} onChange={set("title_es")} />
          </div>
          <div>
            <label className="label" htmlFor="body_es">{d.content.bodyEs}</label>
            <textarea id="body_es" className="field" maxLength={400} value={f.body_es} onChange={set("body_es")} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="title_en">{d.content.titleEn}</label>
            <input id="title_en" className="field" maxLength={80} value={f.title_en} onChange={set("title_en")} />
          </div>
          <div>
            <label className="label" htmlFor="body_en">{d.content.bodyEn}</label>
            <textarea id="body_en" className="field" maxLength={400} value={f.body_en} onChange={set("body_en")} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
        <span className="text-xs text-ink-faint">{d.content.langHint}</span>
        <button type="button" className="btn btn-quiet btn-sm" onClick={polish} disabled={busy !== null || !aiReady} title={aiReady ? undefined : d.content.polishUnavailable}>
          <IconSpark size={15} className="text-red-text" />
          {busy === "polish" ? d.content.polishing : d.content.polish}
        </button>
      </div>

      <ScheduleFields value={schedule} onChange={setSchedule} idPrefix="ann" />

      {usable.length > 0 && (
        <fieldset>
          <legend className="label">{d.content.photo}</legend>
          <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              aria-pressed={mediaId === null}
              onClick={() => setMediaId(null)}
              className={cx(
                "grid h-20 w-24 flex-none place-items-center rounded-xl border text-xs",
                mediaId === null ? "border-red-text text-ink" : "border-line text-ink-faint"
              )}
            >
              {d.content.noPhoto}
            </button>
            {usable.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mediaId === m.id}
                onClick={() => setMediaId(m.id)}
                className={cx("h-20 w-24 flex-none overflow-hidden rounded-xl border-2", mediaId === m.id ? "border-red-text" : "border-transparent")}
              >
                <span className="relative block h-full w-full">
                  <PhotoFrame src={`/api/media/${m.id}`} look={{ ...m, motion: 0 }} alt={m.caption} />
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-red-text">{error}</p>}

      <div className="mt-1 flex items-center justify-between gap-2">
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
        <button type="submit" className="btn btn-primary" disabled={busy !== null}>
          {busy === "save" ? d.common.saving : initial ? d.common.save : d.content.publish}
        </button>
      </div>
    </form>
  );
}

function PhotoSection({ media, scopes, where }: { media: Media[]; scopes: ScopeOption[]; where: (id: number | null) => string }) {
  const d = useDict();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [teamId, setTeamId] = useState<number | null>(scopes[0]?.id ?? null);
  const [uploading, setUploading] = useState(0);
  const [scheduling, setScheduling] = useState(false);
  const [batch, setBatch] = useState<Schedule>({ starts_at: "", ends_at: "" });
  // Foto abierta en el editor; tras subir una sola, se abre sola para ajustarla.
  const [editId, setEditId] = useState<number | null>(null);
  const editing = editId === null ? null : media.find((m) => m.id === editId) ?? null;

  async function upload(files: FileList) {
    const list = Array.from(files).slice(0, 12);
    setUploading(list.length);
    let ok = 0;
    let lastId: number | null = null;
    for (const file of list) {
      try {
        const p = await preparePhoto(file, d.content.unreadable);
        if (p.blob.size > 8 * 1024 * 1024) throw new Error(d.content.tooBig);
        const form = new FormData();
        form.set("file", p.blob, p.blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
        form.set("team_id", teamId === null ? "" : String(teamId));
        form.set("width", String(p.width));
        form.set("height", String(p.height));
        if (scheduling) {
          if (batch.starts_at) form.set("starts_at", batch.starts_at);
          if (batch.ends_at) form.set("ends_at", batch.ends_at);
        }
        const res: { id: number } = await send("/api/media", "POST", form);
        lastId = res.id;
        URL.revokeObjectURL(p.url);
        ok++;
      } catch (e) {
        toast((e as Error).message, "error");
      }
      setUploading((n) => n - 1);
    }
    if (ok) toast(ok === 1 ? d.content.afterUpload : d.content.photosUploaded(ok));
    router.refresh();
    if (ok === 1 && lastId !== null) setEditId(lastId);
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[0.9375rem] font-semibold">{d.content.photos}</h2>
        <div className="flex items-center gap-2">
          {scopes.length > 1 && (
            <select
              className="field !h-8 w-auto !rounded-full !py-0 !pl-3.5 !text-[0.8125rem]"
              aria-label={d.content.where}
              value={teamId === null ? "" : String(teamId)}
              onChange={(e) => setTeamId(e.target.value === "" ? null : Number(e.target.value))}
            >
              {scopes.map((s) => (
                <option key={s.id ?? "plant"} value={s.id === null ? "" : String(s.id)}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-light btn-sm" disabled={uploading > 0} onClick={() => input.current?.click()}>
            <IconCamera size={16} />
            {uploading > 0 ? d.content.uploadingPhotos(uploading) : d.content.addPhotos}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <label className="mb-3 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" className="accent-[var(--color-red)]" checked={scheduling} onChange={(e) => setScheduling(e.target.checked)} />
        {d.content.scheduleBatch}
      </label>
      {scheduling && (
        <div className="mb-4">
          <ScheduleFields value={batch} onChange={setBatch} idPrefix="batch" />
        </div>
      )}
      {media.length === 0 ? (
        <Empty title={d.content.noPhotos}>{d.content.noPhotosBody}</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
          {media.map((m) => (
            <PhotoCard key={m.id} m={m} where={where(m.team_id)} onEdit={() => setEditId(m.id)} />
          ))}
        </div>
      )}
      <Sheet open={editing !== null} onClose={() => setEditId(null)} title={d.content.editPhoto} wide>
        {editing && (
          <PhotoEditor
            key={editing.id}
            m={editing}
            scopes={scopes}
            teamName={editing.team_id === null ? null : where(editing.team_id)}
            onDone={() => setEditId(null)}
          />
        )}
      </Sheet>
    </section>
  );
}

function PhotoCard({ m, where, onEdit }: { m: Media; where: string; onEdit: () => void }) {
  const d = useDict();
  return (
    <figure className={cx("panel overflow-hidden", !m.in_rotation && "opacity-60")}>
      <button type="button" className="relative block w-full text-left" onClick={onEdit} aria-label={d.content.editPhoto}>
        <TvPreview>
          <PhotoFrame src={`/api/media/${m.id}`} look={m} alt={m.caption} />
        </TvPreview>
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[0.7rem] font-medium text-ink-soft">{where}</span>
        <span className="absolute right-2 top-2">
          <ScheduleBadge startsAt={m.starts_at} endsAt={m.ends_at} hidden={!m.in_rotation} />
        </span>
      </button>
      <figcaption className="flex flex-col gap-1.5 p-2.5">
        {m.caption && <div className="line-clamp-2 text-sm text-ink">{m.caption}</div>}
        <div className="text-[0.7rem] text-ink-faint">
          <ScheduleText startsAt={m.starts_at} endsAt={m.ends_at} />
          {m.seconds ? <span>{m.starts_at || m.ends_at ? " · " : ""}{m.seconds}s</span> : null}
        </div>
        <button type="button" className="btn btn-quiet btn-sm self-start" onClick={onEdit}>
          {d.content.adjust}
        </button>
      </figcaption>
    </figure>
  );
}
