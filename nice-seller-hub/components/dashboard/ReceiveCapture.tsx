"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, ImageIcon, Keyboard, Loader2 } from "lucide-react";
import { startManualReception } from "@/app/dashboard/reception-actions";
import { ErrorNote } from "@/components/ui";

/**
 * La pantalla de captura. Un solo gesto: apuntar y tomar la foto.
 *
 * La imagen se reduce **en el teléfono** antes de subirla. Una foto de una
 * cámara moderna pesa 4-8 MB y tarda una eternidad en datos móviles; a 1600 px
 * de lado mayor un ticket sigue siendo perfectamente legible y pesa ~300 KB.
 * Esa diferencia es la que decide si la función se siente instantánea o no.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

async function compress(file: File): Promise<Blob> {
  // createImageBitmap respeta la orientación EXIF; una foto vertical tomada de
  // lado llegaría girada sin esto, y el modelo leería el ticket acostado.
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
  // Si el navegador no pudo convertir, se manda el original: mejor lento que roto.
  return blob ?? file;
}

const STEPS = [
  "Preparando la foto…",
  "Leyendo los códigos…",
  "Buscándolos en el catálogo…",
];

export function ReceiveCapture() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Se limpia el input para que elegir la misma foto otra vez vuelva a disparar.
    e.target.value = "";
    if (!file) return;

    setError(null);
    setBusy(true);
    setStep(0);

    // El avance es una estimación honesta del tiempo típico, no una barra falsa:
    // sin nada en pantalla, veinte segundos se sienten como un cuelgue.
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 6000);

    try {
      const blob = await compress(file);

      const form = new FormData();
      form.append("photo", blob, "ticket.jpg");

      const res = await fetch("/api/dashboard/receptions", { method: "POST", body: form });
      const data = (await res.json()) as {
        ok?: boolean;
        receptionId?: number;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.receptionId) {
        setError(data.error ?? "No pudimos leer el ticket. Intenta otra vez.");
        setBusy(false);
        return;
      }

      router.push(`/dashboard/inventory/receive/${data.receptionId}`);
    } catch {
      setError("No pudimos conectar. Revisa tu señal e intenta otra vez.");
      setBusy(false);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
    }
  }

  function manual() {
    setError(null);
    startTransition(async () => {
      const res = await startManualReception();
      if (res.ok) router.push(`/dashboard/inventory/receive/${res.receptionId}`);
      else setError(res.error);
    });
  }

  if (busy) {
    return (
      <div className="animate-fade flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-20 text-center shadow-card">
        <Loader2 size={28} strokeWidth={1.6} className="animate-spin text-ink" />
        <p className="mt-5 text-[15px] font-medium">{STEPS[step]}</p>
        <p className="mt-1.5 text-[13px] text-mute">Tarda unos segundos. No cierres la pantalla.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />

      <button
        onClick={() => cameraRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-ink px-6 py-12 text-white shadow-lift transition-transform active:scale-[0.99]"
      >
        <Camera size={30} strokeWidth={1.5} />
        <span className="text-[16px] font-medium">Tomar foto del ticket</span>
        <span className="max-w-[15rem] text-[12px] leading-relaxed text-white/60">
          Que se vean completos los renglones de los productos
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => galleryRef.current?.click()}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface text-[14px] font-medium transition-colors hover:border-ink/25"
        >
          <ImageIcon size={16} strokeWidth={1.8} />
          De mi galería
        </button>
        <button
          onClick={manual}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface text-[14px] font-medium transition-colors hover:border-ink/25"
        >
          <Keyboard size={16} strokeWidth={1.8} />
          Escribir códigos
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-mute">
          Para que salga bien
        </p>
        <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-ink-soft">
          <li>· Apoya el ticket en una superficie plana.</li>
          <li>· Buena luz, sin tu sombra encima.</li>
          <li>· Si es muy largo, tómale dos fotos y súbelas por separado.</li>
        </ul>
      </div>
    </div>
  );
}
