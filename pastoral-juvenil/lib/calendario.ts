/** Datos del calendario compartidos entre cliente y servidor (sin secretos). */

export const CALENDAR_ID =
  "47ec66d250eddec04d37d8348072032e5496047ce7b60dbc9b8035f9eef6bd3f@group.calendar.google.com";

/** Enlace "Vincular a mi calendario": agrega el calendario del ministerio al Google Calendar personal. */
export const CALENDAR_SUBSCRIBE_URL = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
  CALENDAR_ID,
)}`;

export type CalendarEvent = {
  id: string;
  titulo: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  lugar: string;
  ministrySlug: string;
  htmlLink?: string;
};
