"use client";

import { useEffect, useRef, useState } from "react";
import type { Conversation, Message, Mode } from "@/lib/db";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";

interface Props {
  conversationId: number;
  onDeleted: () => void;
}

export default function ConversationPanel({ conversationId, onDeleted }: Props) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/messages/${conversationId}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setConversation(data.conversation);
      setMessages(data.messages);
    }

    load();
    const interval = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleModeChange(mode: Mode) {
    if (!conversation) return;
    setConversation({ ...conversation, mode });
    await fetch(`/api/mode/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    try {
      await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const res = await fetch(`/api/messages/${conversationId}`);
      const data = await res.json();
      setMessages(data.messages);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    onDeleted();
  }

  if (!conversation) {
    return <div className="flex-1 p-6 text-sm text-neutral-500">Cargando conversacion...</div>;
  }

  const isHuman = conversation.mode === "HUMAN";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <div>
          <p className="text-sm font-medium text-neutral-100">
            {conversation.name || conversation.phone}
          </p>
          <p className="text-xs text-neutral-500">{conversation.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle mode={conversation.mode} onChange={handleModeChange} />
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-red-800 hover:text-red-400"
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-800 px-5 py-3">
        {isHuman ? (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe un mensaje..."
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-700"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-amber-50 transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-neutral-600">
            El bot responde automaticamente. Cambia a Modo Humano para escribir tu mismo.
          </p>
        )}
      </div>

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
            <p className="text-sm text-neutral-200">
              ¿Borrar esta conversacion? Esta accion no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-700"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
