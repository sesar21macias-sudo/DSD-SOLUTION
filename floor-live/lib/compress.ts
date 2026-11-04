/**
 * Reduce una foto del teléfono (4-12 MB) antes de subirla: lado mayor de 1920 px
 * (lo de una tele Full HD; una lámina de Canva/PowerPoint exportada a 1920×1080
 * entra tal cual). Fotos → JPEG al 85%. PNG/WebP → WebP: conserva la transparencia,
 * y el "Fondo" que elijan en el editor es lo que se ve detrás.
 */
export interface Prepared {
  blob: Blob;
  width: number;
  height: number;
  url: string;
}

const MAX_SIDE = 1920;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** `unreadable` es el mensaje de error, ya traducido por quien llama. */
export async function preparePhoto(file: File, unreadable: string): Promise<Prepared> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const keepAlpha = file.type === "image/png" || file.type === "image/webp";
    const blob = await new Promise<Blob | null>((r) =>
      keepAlpha ? canvas.toBlob(r, "image/webp", 0.9) : canvas.toBlob(r, "image/jpeg", 0.85)
    );
    if (!blob) throw new Error("sin blob");
    return { blob, width, height, url: URL.createObjectURL(blob) };
  } catch {
    // El navegador no pudo decodificarla (p. ej. HEIC en Chrome): si ya es un
    // formato aceptado y no pesa de más, la mandamos tal cual.
    if (ACCEPTED.includes(file.type) && file.size <= 8 * 1024 * 1024) {
      return { blob: file, width: 0, height: 0, url: URL.createObjectURL(file) };
    }
    throw new Error(unreadable);
  }
}
