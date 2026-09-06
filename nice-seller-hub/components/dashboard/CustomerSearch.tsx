"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";

/** Buscador de la cartera. Igual que en inventario: el estado vive en la URL. */
export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);

  function search(value: string) {
    setQuery(value);
    startTransition(() => {
      router.replace(
        value ? `/dashboard/customers?q=${encodeURIComponent(value)}` : "/dashboard/customers"
      );
    });
  }

  return (
    <div className="relative mb-4">
      <Search
        size={16}
        strokeWidth={1.8}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-soft"
      />
      <input
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Buscar por nombre o teléfono"
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
  );
}
