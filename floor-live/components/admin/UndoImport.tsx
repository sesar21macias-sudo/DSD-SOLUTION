"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "../I18n";
import { send, toast } from "../client";

/** Borra una subida del historial (con confirmación en el mismo lugar). */
export function UndoImport({ id }: { id: number }) {
  const d = useDict();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirm) {
    return (
      <button type="button" className="btn btn-danger btn-sm -ml-2 mt-1" onClick={() => setConfirm(true)}>
        {d.data.undo}
      </button>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-bad-wash p-2.5 text-xs">
      <span className="text-ink-soft">{d.data.undoConfirm}</span>
      <div className="flex gap-1">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>
          {d.common.cancel}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res: { removed: number } = await send(`/api/datos?id=${id}`, "DELETE");
              toast(d.data.undone(res.removed));
              router.refresh();
            } catch (e) {
              toast((e as Error).message, "error");
              setBusy(false);
            }
          }}
        >
          {busy ? d.common.deleting : d.common.yes}
        </button>
      </div>
    </div>
  );
}
