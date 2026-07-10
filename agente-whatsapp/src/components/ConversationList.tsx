"use client";

import type { ConversationListItem } from "@/lib/db";

function relativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) return "";
  const diffMs = Date.now() - unixSeconds * 1000;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

interface Props {
  conversations: ConversationListItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-500">
        Todavia no hay conversaciones. En cuanto alguien te escriba por WhatsApp va a aparecer aqui.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-800 overflow-y-auto">
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-neutral-900 ${
              selectedId === c.id ? "bg-neutral-900" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-neutral-100">
                {c.name || c.phone}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c.mode === "AI"
                    ? "bg-emerald-950 text-emerald-400"
                    : "bg-amber-950 text-amber-400"
                }`}
              >
                {c.mode}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-neutral-500">
                {c.last_message_preview || "Sin mensajes"}
              </span>
              <span className="shrink-0 text-[10px] text-neutral-600">
                {relativeTime(c.last_message_at)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
