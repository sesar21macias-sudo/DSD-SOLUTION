"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "../I18n";
import { IconSpark } from "../Icons";
import { send, toast } from "../client";

/**
 * Resumen de la semana en lenguaje sencillo. El admin puede pedir que se
 * reescriba (Claude o reglas) o corregirlo a mano en los dos idiomas.
 */
export function InsightCard({
  text,
  texts,
  scope,
  canEdit,
}: {
  text: string | null;
  texts: { es: string | null; en: string | null };
  scope: string;
  canEdit: boolean;
}) {
  const d = useDict();
  const router = useRouter();
  const [busy, setBusy] = useState<"regen" | "save" | null>(null);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ es: texts.es ?? "", en: texts.en ?? "" });
  if (!text) return null;

  async function regenerate() {
    setBusy("regen");
    try {
      await send("/api/ai/insights", "POST");
      toast(d.panel.regenerated);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    try {
      await send("/api/resumen", "PUT", { scope, ...f });
      toast(d.panel.summarySaved);
      setEdit(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel rise flex flex-col gap-3 p-5" style={{ animationDelay: "120ms" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-red-wash text-red-text">
          <IconSpark size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-stencil text-xs font-bold uppercase tracking-[0.14em] text-red-text">{d.panel.summary}</div>
          <p className="mt-1 text-[1.05rem] leading-snug text-ink">{text}</p>
        </div>
        {canEdit && !edit && (
          <div className="flex gap-1 self-start sm:self-center">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>
              {d.panel.editSummary}
            </button>
            <button type="button" className="btn btn-quiet btn-sm" disabled={busy !== null} onClick={regenerate}>
              {busy === "regen" ? d.panel.regenerating : d.panel.regenerate}
            </button>
          </div>
        )}
      </div>
      {edit && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sum-es">{d.panel.summaryEs}</label>
            <textarea id="sum-es" className="field" maxLength={300} value={f.es} onChange={(e) => setF({ ...f, es: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="sum-en">{d.panel.summaryEn}</label>
            <textarea id="sum-en" className="field" maxLength={300} value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>
              {d.common.cancel}
            </button>
            <button type="button" className="btn btn-light btn-sm" disabled={busy !== null} onClick={save}>
              {busy === "save" ? d.common.saving : d.common.save}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
