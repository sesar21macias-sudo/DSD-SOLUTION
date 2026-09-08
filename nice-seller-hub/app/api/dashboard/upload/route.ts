import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/session";
import { getEnv } from "@/lib/env";
import { isAcceptedImageType } from "@/lib/ocr";
import { randomHex } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Sube una foto desde el dispositivo (perfil, portada o pieza) a R2 y
 * devuelve la URL con la que se sirve.
 *
 * Es el mismo camino para las tres: el campo de destino sigue siendo un
 * simple `<input type="text">` con una URL, asi que nada de lo que ya guarda
 * esa URL —el perfil, el alta de una pieza— tuvo que cambiar. Este endpoint
 * solo le da a esa URL de donde salir.
 */

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  let seller;
  try {
    ({ seller } = await requireSeller());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Tu sesión expiró. Vuelve a entrar." },
      { status: 401 }
    );
  }

  const env = await getEnv();
  if (!env.MEDIA) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Subir fotos desde el dispositivo no está disponible todavía. Pega el enlace de una imagen.",
      },
      { status: 503 }
    );
  }

  // Por distribuidora: subir una foto no cuesta dinero como el OCR, pero
  // sigue siendo escritura publica y conviene un techo contra el abuso.
  const limit = await rateLimit("upload", `seller:${seller.id}`, 60, 3600);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Subiste demasiadas fotos seguidas. Espera un momento." },
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
      { ok: false, error: "La foto pesa demasiado. Intenta con otra." },
      { status: 413 }
    );
  }
  if (!isAcceptedImageType(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Ese archivo no es una imagen que podamos usar." },
      { status: 415 }
    );
  }

  // La llave lleva el id de la tienda para poder auditar o limpiar por
  // distribuidora si algun dia hace falta, y un nombre al azar para que dos
  // fotos subidas al mismo segundo nunca se pisen.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `sellers/${seller.id}/${randomHex(16)}.${ext}`;

  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return NextResponse.json({ ok: true, url: `/api/media/${key}` });
}
