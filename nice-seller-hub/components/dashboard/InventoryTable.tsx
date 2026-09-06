"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { adjustStock, deleteInventoryItem, toggleVisibility } from "@/app/dashboard/actions";
import type { InventoryItem } from "@/lib/seller";
import { STATUS_LABELS } from "@/lib/inventory";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { StatusDot } from "@/components/ui";

/**
 * La lista de inventario.
 *
 * El cambio de existencias esta a un toque, sin abrir nada: es la accion que
 * una distribuidora hace mas veces al dia, muchas veces de pie y con una mano.
 * Editar precio y datos si abre el formulario completo, porque se hace poco.
 */
export function InventoryTable({
  items,
  initialQuery,
  slug,
}: {
  items: InventoryItem[];
  initialQuery: string;
  slug: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [confirming, setConfirming] = useState<number | null>(null);

  function search(value: string) {
    setQuery(value);
    startTransition(() => {
      router.replace(value ? `/dashboard/inventory?q=${encodeURIComponent(value)}` : "/dashboard/inventory");
    });
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast(res.error ?? "No pudimos guardar el cambio.", "error");
      else if (success) toast(success);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search
          size={16}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-soft"
        />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Buscar por nombre o código NICE"
          className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-9 text-[15px] placeholder:text-mute-soft focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5"
        />
        {query && (
          <button
            onClick={() => search("")}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-mute hover:bg-line"
            aria-label="Limpiar"
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong py-10 text-center text-[14px] text-mute">
          Nada coincide con “{query}”.
        </p>
      )}

      <ul className={`space-y-2.5 transition-opacity ${pending ? "opacity-60" : ""}`}>
        {items.map((item) => {
          const status = STATUS_LABELS[item.status];

          return (
            <li
              key={item.inventoryId}
              className="rounded-2xl border border-line bg-surface p-3 shadow-card"
            >
              <div className="flex gap-3">
                <Link
                  href={`/${slug}/product/${item.niceCode}`}
                  target="_blank"
                  className="shrink-0 overflow-hidden rounded-xl bg-canvas"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-16 w-16 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center text-[9px] tracking-[0.2em] text-mute-soft">
                      NICE
                    </span>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">{item.name}</p>
                      <p className="text-[11px] tabular-nums text-mute">
                        {item.niceCode}
                        {item.categoryName ? ` · ${item.categoryName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[15px] font-medium tabular-nums">
                      {formatMoney(item.priceCents)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <StatusDot className={status.dot} />
                      <span className={status.text}>{status.label}</span>
                    </span>

                    <div className="ml-auto flex items-center gap-1">
                      <div className="flex h-8 items-center rounded-lg border border-line-strong">
                        <button
                          onClick={() => run(() => adjustStock(item.inventoryId, -1))}
                          disabled={item.stock <= 0}
                          className="grid h-full w-7 place-items-center rounded-l-lg text-ink-soft transition-colors hover:bg-line/50 disabled:opacity-25"
                          aria-label="Quitar una pieza"
                        >
                          <Minus size={12} strokeWidth={2.4} />
                        </button>
                        <span className="w-8 text-center text-[13px] font-medium tabular-nums">
                          {item.stock}
                        </span>
                        <button
                          onClick={() => run(() => adjustStock(item.inventoryId, 1))}
                          className="grid h-full w-7 place-items-center rounded-r-lg text-ink-soft transition-colors hover:bg-line/50"
                          aria-label="Agregar una pieza"
                        >
                          <Plus size={12} strokeWidth={2.4} />
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          run(
                            () => toggleVisibility(item.inventoryId, !item.isVisible),
                            item.isVisible ? "Oculta de tu tienda" : "Visible en tu tienda"
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-ink-soft transition-colors hover:bg-line/50"
                        aria-label={item.isVisible ? "Ocultar de la tienda" : "Mostrar en la tienda"}
                        title={item.isVisible ? "Ocultar de la tienda" : "Mostrar en la tienda"}
                      >
                        {item.isVisible ? (
                          <Eye size={14} strokeWidth={1.8} />
                        ) : (
                          <EyeOff size={14} strokeWidth={1.8} />
                        )}
                      </button>

                      <Link
                        href={`/dashboard/inventory/${item.inventoryId}`}
                        className="grid h-8 items-center rounded-lg border border-line-strong px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-line/50"
                      >
                        Editar
                      </Link>

                      <button
                        onClick={() => setConfirming(item.inventoryId)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-mute transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Eliminar ${item.name}`}
                      >
                        <Trash2 size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {confirming === item.inventoryId && (
                <div className="animate-fade-up mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3.5 py-3">
                  <p className="flex-1 text-[13px] text-red-800">
                    ¿Quitar {item.name} de tu inventario? Tus ventas anteriores no se borran.
                  </p>
                  <button
                    onClick={() => setConfirming(null)}
                    className="h-8 rounded-lg px-3 text-[13px] font-medium text-red-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setConfirming(null);
                      run(() => deleteInventoryItem(item.inventoryId), "Pieza eliminada");
                    }}
                    className="h-8 rounded-lg bg-red-600 px-3 text-[13px] font-medium text-white"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
