/**
 * Reduce una foto del teléfono (4-12 MB) a ~300 KB antes de subirla:
 * lado mayor de 1600 px, JPEG al 82%. En la planta la señal suele ser mala
 * y nadie necesita la foto original para ver si una costura quedó bien.
 */
export interface Prepared {
  blob: Blob;
  width: number;
  height: number;
  url: string;
}

const MAX_SIDE = 1600;
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
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
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
