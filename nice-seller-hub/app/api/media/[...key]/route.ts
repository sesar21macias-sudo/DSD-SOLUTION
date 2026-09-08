import { getEnv } from "@/lib/env";

/**
 * Sirve una foto guardada en R2.
 *
 * Es una ruta publica de solo lectura: las fotos de perfil, portada y piezas
 * las ve cualquiera que visite una tienda, igual que las que ya viven en el
 * CDN de NICE. `[...key]` es un catch-all porque la llave lleva diagonales
 * (`sellers/12/abc123.jpg`) y una ruta con un solo segmento no la aguantaria.
 */

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const env = await getEnv();

  if (!env.MEDIA) return new Response("No encontrada", { status: 404 });

  const object = await env.MEDIA.get(key.join("/"));
  if (!object) return new Response("No encontrada", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      // Un año: la llave incluye un nombre al azar, asi que una foto nunca
      // cambia de contenido bajo la misma URL. Si algun dia se reemplaza, sube
      // con una llave nueva en vez de pisar la vieja.
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
}
