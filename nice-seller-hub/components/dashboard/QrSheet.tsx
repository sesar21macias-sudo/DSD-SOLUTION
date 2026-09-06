"use client";

import { useState } from "react";
import { Check, Printer } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { useToast } from "@/components/Toast";

/**
 * Hoja de etiquetas imprimible.
 *
 * La impresion la hace el navegador con `window.print()` sobre la misma
 * pagina: una regla `@media print` esconde la navegacion y deja solo la
 * cuadricula de etiquetas. Es mas confiable que generar un PDF en el servidor
 * y sale con la resolucion de la impresora, no con la de una imagen.
 */

interface QrItem {
  inventoryId: number;
  niceCode: string;
  name: string;
  priceCents: number;
  url: string;
  svg: string;
}

export function QrSheet({
  codes,
  businessName,
}: {
  codes: QrItem[];
  businessName: string;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const chosen = selected.size > 0 ? codes.filter((c) => selected.has(c.inventoryId)) : [];

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function print() {
    if (chosen.length === 0) {
      toast("Selecciona al menos una pieza.", "error");
      return;
    }
    window.print();
  }

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => setSelected(new Set(codes.map((c) => c.inventoryId)))}
          className="h-9 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-medium transition-colors hover:border-ink/25"
        >
          Seleccionar todas
        </button>
        <button
          onClick={() => setSelected(new Set())}
          className="h-9 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-medium transition-colors hover:border-ink/25"
        >
          Ninguna
        </button>
        <button
          onClick={print}
          disabled={selected.size === 0}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-[13px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <Printer size={15} strokeWidth={1.9} />
          Imprimir {selected.size > 0 ? `(${selected.size})` : ""}
        </button>
      </div>

      {/* Selector en pantalla */}
      <ul className="no-print grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {codes.map((c) => {
          const on = selected.has(c.inventoryId);
          return (
            <li key={c.inventoryId}>
              <button
                onClick={() => toggle(c.inventoryId)}
                className={`relative w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                  on
                    ? "border-ink bg-surface shadow-lift"
                    : "border-line bg-surface shadow-card hover:border-ink/25"
                }`}
              >
                <span
                  className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border transition-colors ${
                    on ? "border-ink bg-ink text-white" : "border-line-strong"
                  }`}
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </span>

                <div
                  className="mx-auto h-24 w-24 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: c.svg }}
                />

                <p className="mt-3 truncate text-[13px] font-medium">{c.name}</p>
                <p className="text-[11px] tabular-nums text-mute">{c.niceCode}</p>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Hoja de impresion: solo se ve al imprimir */}
      <div className="hidden print:block">
        <div className="mb-6 flex items-baseline justify-between border-b border-neutral-300 pb-3">
          <Logo size="sm" />
          <span className="text-[11px]">{businessName}</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {chosen.map((c) => (
            <div
              key={c.inventoryId}
              className="break-inside-avoid rounded-lg border border-neutral-300 p-3 text-center"
            >
              <div
                className="mx-auto h-24 w-24 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: c.svg }}
              />
              <p className="mt-2 text-[11px] font-medium leading-tight">{c.name}</p>
              <p className="text-[10px] tabular-nums">{c.niceCode}</p>
              <p className="mt-0.5 text-[12px] font-medium tabular-nums">
                {formatMoney(c.priceCents)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
