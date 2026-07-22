/**
 * Cliente de Google APIs (Calendar + Drive) usando el refresh token de la
 * cuenta admin del ministerio. Solo para uso en el servidor.
 */

import { CALENDAR_ID, type CalendarEvent } from "@/lib/calendario";

export { CALENDAR_ID };
export type { CalendarEvent };

export const CALENDAR_TIMEZONE = "America/Mexico_City";

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

export async function getGoogleAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Faltan las credenciales de Google en el entorno.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("No se pudo obtener el access token de Google.");
  }
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

export async function googleFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGoogleAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------

type GoogleEvent = {
  id: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

function toCalendarEvent(e: GoogleEvent): CalendarEvent {
  const startRaw = e.start?.dateTime ?? e.start?.date ?? "";
  // dateTime viene con offset local del calendario, ej. 2026-07-26T17:30:00-06:00
  const [fecha, resto] = startRaw.split("T");
  const hora = resto ? resto.slice(0, 5) : "00:00";
  return {
    id: e.id,
    titulo: e.summary ?? "(sin título)",
    fecha: fecha ?? "",
    hora,
    lugar: e.location ?? "",
    ministrySlug: e.extendedProperties?.private?.ministrySlug ?? "coordinacion-general",
    htmlLink: e.htmlLink,
  };
}

const CAL_BASE = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}`;

/** Próximos eventos del calendario del ministerio (lectura pública). */
export async function listUpcomingEvents(): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const res = await googleFetch(`${CAL_BASE}/events?${params}`);
  if (!res.ok) throw new Error(`Calendar list falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { items?: GoogleEvent[] };
  return (data.items ?? []).map(toCalendarEvent);
}

export async function createCalendarEvent(input: {
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string;
  ministrySlug: string;
  duracionMin?: number;
}): Promise<CalendarEvent> {
  const start = `${input.fecha}T${input.hora}:00`;
  const [h, m] = input.hora.split(":").map(Number);
  const endDate = new Date(Date.UTC(2000, 0, 1, h, m + (input.duracionMin ?? 60)));
  const end = `${input.fecha}T${String(endDate.getUTCHours()).padStart(2, "0")}:${String(
    endDate.getUTCMinutes(),
  ).padStart(2, "0")}:00`;

  const res = await googleFetch(`${CAL_BASE}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: input.titulo,
      location: input.lugar,
      start: { dateTime: start, timeZone: CALENDAR_TIMEZONE },
      end: { dateTime: end, timeZone: CALENDAR_TIMEZONE },
      extendedProperties: { private: { ministrySlug: input.ministrySlug } },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 24 * 60 },
          { method: "popup", minutes: 60 },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`Calendar insert falló: ${res.status} ${await res.text()}`);
  return toCalendarEvent((await res.json()) as GoogleEvent);
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const res = await googleFetch(`${CAL_BASE}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 410) {
    throw new Error(`Calendar delete falló: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Drive (documentos del agente)
// ---------------------------------------------------------------------------

const DRIVE_MIME = {
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
} as const;

export type DriveFileKind = keyof typeof DRIVE_MIME;

export async function createDriveFile(input: {
  kind: DriveFileKind;
  name: string;
  folderId: string;
}): Promise<{ id: string; name: string; webViewLink: string }> {
  const res = await googleFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink",
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        mimeType: DRIVE_MIME[input.kind],
        parents: [input.folderId],
      }),
    },
  );
  if (!res.ok) throw new Error(`Drive create falló: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; name: string; webViewLink: string };
}

export async function listDriveFolder(folderId: string): Promise<
  { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }[]
> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: "50",
  });
  const res = await googleFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  if (!res.ok) throw new Error(`Drive list falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { files?: [] };
  return data.files ?? [];
}

/** Inserta texto al inicio de un Google Doc (para minutas y planes). */
export async function appendToGoogleDoc(docId: string, text: string): Promise<void> {
  const res = await googleFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text } }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Docs update falló: ${res.status} ${await res.text()}`);
}
