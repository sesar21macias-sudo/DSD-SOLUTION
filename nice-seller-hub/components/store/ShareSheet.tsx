"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Facebook, MessageCircle, X } from "lucide-react";
import { buildShareMessage } from "@/lib/whatsapp";
import { useToast } from "@/components/Toast";

/**
 * Hoja para compartir la tienda. En movil sale desde abajo, como una hoja
 * nativa; en escritorio se centra.
 *
 * El enlace se arma en el cliente con `location.origin` en vez de una variable
 * de entorno: asi funciona igual en el dominio de produccion, en una vista
 * previa y en local, sin configurar nada.
 */
export function ShareSheet({
  slug,
  businessName,
  onClose,
}: {
  slug: string;
  businessName: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setUrl(`${window.location.origin}/${slug}`);
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const message = buildShareMessage(businessName, url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("No pudimos copiar el enlace. Selecciónalo a mano.", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-slide-up safe-bottom relative w-full max-w-md rounded-t-3xl bg-surface p-6 shadow-lift sm:animate-scale-in sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold">Compartir mi tienda</h2>
            <p className="mt-0.5 text-[13px] text-mute">Quien abra el enlace ve tu inventario.</p>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 -mt-1 grid h-9 w-9 place-items-center rounded-full text-mute transition-colors hover:bg-line/60"
            aria-label="Cerrar"
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-line bg-canvas px-3.5 py-3">
          <p className="truncate text-[13px] text-ink-soft">{url || "…"}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[14px] font-medium text-white transition-transform active:scale-[0.98]"
          >
            <MessageCircle size={16} strokeWidth={1.9} />
            WhatsApp
          </a>
          <button
            onClick={copy}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-[14px] font-medium transition-transform active:scale-[0.98]"
          >
            {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.8} />}
            {copied ? "Copiado" : "Copiar enlace"}
          </button>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-[14px] font-medium transition-transform active:scale-[0.98]"
          >
            <Facebook size={16} strokeWidth={1.8} />
            Facebook
          </a>
        </div>
      </div>
    </div>
  );
}
