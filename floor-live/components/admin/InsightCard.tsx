"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "../I18n";
import { IconSpark } from "../Icons";
import { send, toast } from "../client";

/** Resumen de la semana en lenguaje sencillo; el admin puede pedir que se reescriba. */
export function InsightCard({ text, canRegenerate }: { text: string | null; canRegenerate: boolean }) {
  const d = useDict();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!text) return null;
  return (
    <div className="panel rise flex flex-col gap-3 p-5 sm:flex-row sm:items-center" style={{ animationDelay: "120ms" }}>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-red-wash text-red-text">
        <IconSpark size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-stencil text-xs font-bold uppercase tracking-[0.14em] text-red-text">{d.panel.summary}</div>
        <p className="mt-1 text-[1.05rem] leading-snug text-ink">{text}</p>
      </div>
      {canRegenerate && (
        <button
          type="button"
          className="btn btn-quiet btn-sm self-start sm:self-center"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await send("/api/ai/insights", "POST");
              toast(d.panel.regenerated);
              router.refresh();
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? d.panel.regenerating : d.panel.regenerate}
        </button>
      )}
    </div>
  );
}
