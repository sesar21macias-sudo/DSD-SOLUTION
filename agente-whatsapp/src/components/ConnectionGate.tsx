"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus, ConversationListItem } from "@/lib/db";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";

interface StatusResponse {
  status: ConnectionStatus;
  qrPng?: string;
  phone?: string | null;
}

export default function ConnectionGate() {
  const [statusData, setStatusData] = useState<StatusResponse>({ status: "disconnected" });
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await fetch("/api/connection/status");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setStatusData(data);
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (statusData.status !== "connected") return;
    let cancelled = false;

    async function loadConversations() {
      const res = await fetch("/api/conversations");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setConversations(data.conversations);
    }

    loadConversations();
    const interval = setInterval(loadConversations, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [statusData.status]);

  async function handleDisconnect() {
    await fetch("/api/connection/disconnect", { method: "POST" });
    setSelectedId(null);
    setStatusData({ status: "disconnected" });
  }

  if (statusData.status !== "connected") {
    return <QRScreen status={statusData.status} qrPng={statusData.qrPng ?? null} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader phone={statusData.phone ?? null} onDisconnect={handleDisconnect} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-neutral-800">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        {selectedId ? (
          <ConversationPanel
            key={selectedId}
            conversationId={selectedId}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-600">
            Selecciona una conversacion
          </div>
        )}
      </div>
    </div>
  );
}
