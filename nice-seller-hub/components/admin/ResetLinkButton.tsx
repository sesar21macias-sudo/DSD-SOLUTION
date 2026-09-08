"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, MessageCircle, X } from "lucide-react";
import { generateResetLink } from "@/app/admin/sellers/actions";

/**
 * Generar un enlace para que una distribuidora vuelva a poner su contraseña.
 *
 * El enlace aparece una sola vez, aquí, y se manda por WhatsApp de un toque —
 * que es por donde ya se hablan. No se guarda en claro en ningún lado: si se
 * pierde, se genera otro.
 */
export function ResetLinkButton({
  userId,
  businessName,
  whatsapp,
}: {
  userId: number;
  businessName: string;
  whatsapp: string;
}) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateResetLink(userId);
      if (!res.ok || !res.url) {
        setError(res.error ?? "No se pudo generar.");
        return;
      }
      setLink(res.url);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin portapapeles el enlace sigue visible y seleccionable.
    }
  }

  if (link) {
    const message = `Hola 👋 Aquí está tu enlace para poner una contraseña nueva en tu tienda:\n\n${link}\n\nSirve una sola vez y vence en 12 horas.`;

    return (
      <div className="w-full rounded-xl border border-line-strong bg-canvas p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium">Enlace para {businessName}</p>
          <button
            onClick={() => setLink(null)}
            className="grid h-6 w-6 place-items-center rounded-md text-mute hover:bg-line/60"
            aria-label="Cerrar"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>

        <p className="mt-1.5 break-all rounded-lg bg-surface px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
          {link}
        </p>

        <div className="mt-2 flex gap-1.5">
          <button
            onClick={copy}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface text-[12px] font-medium transition-colors hover:border-ink/25"
          >
            {copied ? (
              <Check size={12} strokeWidth={2.4} className="text-emerald-600" />
            ) : (
              <Copy size={12} strokeWidth={1.9} />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-[12px] font-medium text-white"
          >
            <MessageCircle size={12} strokeWidth={2.2} />
            Enviar
          </a>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-mute">
          Sirve una sola vez y vence en 12 horas. No se guarda: si lo pierdes, genera otro.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-40"
      >
        <KeyRound size={13} strokeWidth={1.9} />
        {pending ? "Generando…" : "Contraseña"}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
