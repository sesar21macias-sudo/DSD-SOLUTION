import "server-only";
import { randomHex } from "./auth";
import { getEnv } from "./env";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * El tipo se decide por los primeros bytes del archivo, no por lo que diga el
 * navegador: así nadie sube un HTML o un SVG con script disfrazado de foto.
 */
export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function putPhoto(scope: string, data: ArrayBuffer, type: string): Promise<string> {
  const key = `${scope}/${Date.now()}-${randomHex(8)}`;
  await (await getEnv()).MEDIA.put(key, data, { httpMetadata: { contentType: type } });
  return key;
}

export async function deletePhoto(key: string): Promise<void> {
  await (await getEnv()).MEDIA.delete(key);
}
