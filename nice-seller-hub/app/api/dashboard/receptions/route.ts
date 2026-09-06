import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/session";
import { isAcceptedImageType, readTicket } from "@/lib/ocr";
import { createDraftReception } from "@/lib/receptions";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Foto del ticket → borrador de recepción.
 *
 * Va por endpoint y no por Server Action porque sube una imagen: así el
 * navegador puede comprimirla antes y mostrar progreso mientras el modelo
 * lee, en vez de dejar un botón congelado.
 *
 * Nunca escribe en el inventario. Solo crea el borrador que la persona revisa.
 */

/**
 * 4 MB después de que el navegador comprime. Alcanza de sobra para un ticket
 * legible y frena la subida de una foto de 12 MP desde datos móviles.
 */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  let seller;
  try {
    ({ seller } = await requireSeller());
  } catch {
    // Sin esto, requireSeller lanzaría y el navegador recibiría un 500 opaco.
    return NextResponse.json(
      { ok: false, error: "Tu sesión expiró. Vuelve a entrar." },
      { status: 401 }
    );
  }

  // Leer un ticket cuesta dinero por llamada; el límite es por distribuidora,
  // no por IP, porque varias pueden compartir la conexión de un local.
  const limit = await rateLimit("ticket", `seller:${seller.id}`, 30, 3600);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Llegaste al límite de tickets por hora. Puedes seguir capturando a mano.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No recibimos la foto." }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No recibimos la foto." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "La foto llegó vacía." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "La foto pesa demasiado. Intenta de nuevo." },
      { status: 413 }
    );
  }
  if (!isAcceptedImageType(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Ese archivo no es una imagen que podamos leer." },
      { status: 415 }
    );
  }

  const base64 = toBase64(await file.arrayBuffer());
  const read = await readTicket(base64, file.type);

  if (!read.ok) {
    return NextResponse.json({ ok: false, error: read.error }, { status: 422 });
  }

  const receptionId = await createDraftReception(
    seller.id,
    read.lines,
    "photo",
    read.declaredItems
  );

  return NextResponse.json({
    ok: true,
    receptionId,
    detected: read.lines.length,
  });
}

/**
 * `Buffer` no existe en el runtime de Workers. Se convierte por bloques porque
 * `String.fromCharCode(...bytes)` con un arreglo de megabytes desborda la pila
 * de argumentos.
 */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
