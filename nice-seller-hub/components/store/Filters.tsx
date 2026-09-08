"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { StoreCategory } from "@/lib/store";

/**
 * Busqueda y filtros. El estado vive en la URL, no en React: asi el enlace de
 * "anillos ordenados por precio" se puede compartir, el boton de regresar
 * funciona y la pagina se sigue renderizando en el servidor.
 */

const SORTS = [
  { id: "recent", label: "Más recientes" },
  { id: "price_asc", label: "Precio: menor a mayor" },
  { id: "price_desc", label: "Precio: mayor a menor" },
  { id: "best_sellers", label: "Más vendidos" },
];

export function Filters({
  categories,
  finishes,
  total,
}: {
  categories: StoreCategory[];
  finishes: string[];
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "recent";
  const finish = params.get("finish") ?? "";
  const availability = params.get("availability") ?? "";

  const [draft, setDraft] = useState(q);
  const first = useRef(true);

  // La URL se actualiza 280 ms despues de la ultima tecla. Sin esa espera,
  // escribir "collar" dispararia seis renders del servidor.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push({ q: draft || null }), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => setDraft(q), [q]);

  function push(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `?${query}` : "?", { scroll: false });
    });
  }

  const activeExtras = [finish, availability].filter(Boolean).length;

  return (
    <div className="sticky top-14 z-30 -mx-5 mb-6 bg-canvas/85 px-5 pb-3 pt-3 backdrop-blur-xl">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-soft"
          />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Buscar pieza o código"
            inputMode="search"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-9 text-[15px] placeholder:text-mute-soft focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5"
          />
          {draft && (
            <button
              onClick={() => setDraft("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-mute transition-colors hover:bg-line"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors ${
            open || activeExtras > 0
              ? "border-ink bg-ink text-white"
              : "border-line-strong bg-surface text-ink-soft hover:border-ink/25"
          }`}
          aria-label="Más filtros"
          aria-expanded={open}
        >
          <SlidersHorizontal size={16} strokeWidth={1.8} />
          {activeExtras > 0 && !open && (
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-nice text-[10px] font-semibold text-white">
              {activeExtras}
            </span>
          )}
        </button>
      </div>

      {categories.length > 0 && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          <Chip active={!category} onClick={() => push({ category: null })}>
            Todo
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.slug}
              active={category === c.slug}
              onClick={() => push({ category: category === c.slug ? null : c.slug })}
            >
              {c.name}
              <span className="ml-1.5 text-[11px] opacity-50 tabular-nums">{c.count}</span>
            </Chip>
          ))}
        </div>
      )}

      {open && (
        <div className="animate-fade-up mt-3 grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-mute">Ordenar por</span>
            <select
              value={sort}
              onChange={(e) => push({ sort: e.target.value === "recent" ? null : e.target.value })}
              className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {finishes.length > 0 && (
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-mute">Acabado</span>
              <select
                value={finish}
                onChange={(e) => push({ finish: e.target.value || null })}
                className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
              >
                <option value="">Todos</option>
                {finishes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-mute">Disponibilidad</span>
            <select
              value={availability}
              onChange={(e) => push({ availability: e.target.value || null })}
              className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
            >
              <option value="">Solo disponibles</option>
              <option value="all">Incluir agotados</option>
            </select>
          </label>
        </div>
      )}

      <p
        className={`mt-3 text-[12px] text-mute transition-opacity ${
          pending ? "opacity-40" : "opacity-100"
        }`}
      >
        {total} {total === 1 ? "pieza" : "piezas"}
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ${
        active
          ? "bg-ink text-white"
          : "border border-line-strong bg-surface text-ink-soft hover:border-ink/25"
      }`}
    >
      {children}
    </button>
  );
}
