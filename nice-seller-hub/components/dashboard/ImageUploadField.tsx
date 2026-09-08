"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { inputClass } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Un campo de foto que acepta las dos cosas: pegar un enlace, o tomarla o
 * elegirla desde el dispositivo.
 *
 * Sigue siendo, para el formulario que la contiene, un simple campo de texto
 * con una URL — el mismo que ya se guardaba antes de que existiera esto. Subir
 * una foto solo hace una cosa mas: reemplazar ese texto por la URL que
 * devuelve el servidor. Nada de lo que ya sabe guardar una URL tuvo que
 * cambiar para que esto funcionara.
 */

/** 1600 px de lado mayor: una pieza de joyeria se ve nitida y pesa poco. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

async function compress(file: File): Promise<Blob> {
  // createImageBitmap respeta la orientacion EXIF; sin esto una foto vertical
  // tomada de lado llegaria girada.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  // Si el navegador no pudo convertir, se manda el original: mejor lenta que rota.
  return blob ?? file;
}

export function ImageUploadField({
  name,
  defaultValue = "",
  placeholder = "https://…",
  showPreview = true,
  onValueChange,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  /** Ensena su propia vista previa cuadrada. Apagalo si el formulario ya trae una. */
  showPreview?: boolean;
  /** Se llama con la URL en cada cambio, sea a mano o por subida. */
  onValueChange?: (url: string) => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function update(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // para poder elegir la misma foto otra vez si hace falta
    if (!file) return;

    setUploading(true);
    try {
      const blob = await compress(file);
      const body = new FormData();
      body.append("photo", blob, "foto.jpg");

      const res = await fetch("/api/dashboard/upload", { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };

      if (!res.ok || !data.ok || !data.url) {
        toast(data.error ?? "No pudimos subir la foto.", "error");
        return;
      }
      update(data.url);
    } catch {
      toast("No pudimos conectar. Revisa tu señal e intenta otra vez.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => update(e.target.value)}
          placeholder={placeholder}
          inputMode="url"
          maxLength={500}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface text-ink-soft transition-colors hover:border-ink/25 disabled:opacity-50"
          aria-label="Subir foto desde tu dispositivo"
          title="Subir desde tu dispositivo"
        >
          {uploading ? (
            <Loader2 size={17} strokeWidth={2} className="animate-spin" />
          ) : (
            <Camera size={17} strokeWidth={1.8} />
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
      </div>

      {showPreview && value.startsWith("http") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Vista previa"
          className="mt-2.5 h-24 w-24 rounded-2xl border border-line object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}
