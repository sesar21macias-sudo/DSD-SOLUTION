"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent } from "@/lib/calendario";

type EventDraft = Omit<CalendarEvent, "id" | "ministrySlug" | "htmlLink">;

/** Eventos reales del Google Calendar del ministerio, vía el API del sitio. */
export function useEventosState(ministrySlug: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/events?ministry=${encodeURIComponent(ministrySlug)}`);
      const data: { ok: boolean; events?: CalendarEvent[]; error?: string } = await res.json();
      if (!data.ok) throw new Error(data.error);
      setEvents(data.events ?? []);
      setError(null);
    } catch {
      setError("No se pudo cargar el calendario. Intenta de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  }, [ministrySlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addEvent(draft: EventDraft): Promise<string | null> {
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, ministrySlug }),
    });
    const data: { ok: boolean; event?: CalendarEvent; error?: string } = await res.json();
    if (!data.ok || !data.event) return data.error ?? "No se pudo crear el evento.";
    setEvents((prev) =>
      [...prev, data.event!].sort((a, b) =>
        `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`),
      ),
    );
    return null;
  }

  async function removeEvent(id: string): Promise<string | null> {
    const res = await fetch(`/api/calendar/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data: { ok: boolean; error?: string } = await res.json();
    if (!data.ok) return data.error ?? "No se pudo borrar el evento.";
    setEvents((prev) => prev.filter((e) => e.id !== id));
    return null;
  }

  return { events, loading, error, addEvent, removeEvent, refresh };
}
