import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { createCalendarEvent, listUpcomingEvents } from "@/lib/google";
import { getMinistryBySlug } from "@/lib/ministryFolders";

/** Lectura pública: próximos eventos, opcionalmente filtrados por ministerio. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ministry = url.searchParams.get("ministry");
    let events = await listUpcomingEvents();
    if (ministry) {
      events = events.filter(
        (e) => e.ministrySlug === ministry || e.ministrySlug === "coordinacion-general",
      );
    }
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    console.error("GET /api/calendar/events", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo consultar el calendario." },
      { status: 502 },
    );
  }
}

/** Crear evento: solo administradores. */
export async function POST(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { ok: false, error: "Requiere sesión de administrador." },
      { status: 401 },
    );
  }

  let body: {
    titulo?: string;
    fecha?: string;
    hora?: string;
    lugar?: string;
    ministrySlug?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const { titulo, fecha, hora, lugar, ministrySlug } = body;
  if (
    !titulo?.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "") ||
    !/^\d{2}:\d{2}$/.test(hora ?? "") ||
    !lugar?.trim() ||
    !ministrySlug ||
    !getMinistryBySlug(ministrySlug)
  ) {
    return NextResponse.json(
      { ok: false, error: "Faltan datos del evento o son inválidos." },
      { status: 400 },
    );
  }

  try {
    const event = await createCalendarEvent({
      titulo: titulo.trim(),
      fecha: fecha!,
      hora: hora!,
      lugar: lugar.trim(),
      ministrySlug,
    });
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    console.error("POST /api/calendar/events", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo crear el evento en Google Calendar." },
      { status: 502 },
    );
  }
}
