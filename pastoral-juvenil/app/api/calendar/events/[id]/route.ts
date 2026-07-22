import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { deleteCalendarEvent } from "@/lib/google";

/** Borrar evento: solo administradores. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminSession())) {
    return NextResponse.json(
      { ok: false, error: "Requiere sesión de administrador." },
      { status: 401 },
    );
  }

  const { id } = await params;
  try {
    await deleteCalendarEvent(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/calendar/events/[id]", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo borrar el evento." },
      { status: 502 },
    );
  }
}
