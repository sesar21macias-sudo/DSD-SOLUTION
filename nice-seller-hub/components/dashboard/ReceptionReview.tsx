"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  addManualItem,
  cancelReception,
  confirmReceptionAction,
  findInCatalog,
  linkItemToProduct,
  lookupItemOnNice,
  removeItem,
  setItemPrice,
  setItemQuantity,
} from "@/app/dashboard/reception-actions";
import type { CatalogMatch } from "@/lib/receptions";
import type { ReceptionItemView } from "@/lib/receptions";
import { centsToPesosInput, formatMoney } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Button, ErrorNote } from "@/components/ui";

/**
 * La revisión antes de confirmar.
 *
 * Pensada para pasar veinte o cincuenta renglones rápido: lo que está bien no
 * pide nada —se ve la foto, el nombre y la cantidad, y se sigue de largo— y
 * solo lo dudoso levanta la mano. Los renglones que necesitan atención suben
 * hasta arriba, porque son los únicos que cuestan tiempo.
 */
export function ReceptionReview({
  receptionId,
  items,
  categories,
  declaredItems,
}: {
  receptionId: number;
  items: ReceptionItemView[];
  categories: { id: number; name: string }[];
  declaredItems: number | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "No pudimos guardar el cambio.");
      else if (res.message) toast(res.message);
      router.refresh();
    });
  }

  // Lo que necesita atención primero; lo demás en el orden del ticket.
  const needsWork = items.filter(
    (i) => i.status === "not_found" || (i.status !== "skipped" && !i.priceCents) || i.confidence === "low"
  );
  const clean = items.filter((i) => !needsWork.includes(i));

  const ready = items.filter(
    (i) => i.status === "matched" && i.quantity > 0 && (i.priceCents ?? 0) > 0
  );
  const totalPieces = ready.reduce((s, i) => s + i.quantity, 0);
  const pendingCount = items.filter(
    (i) => i.status === "not_found" || (i.status === "matched" && !i.priceCents)
  ).length;

  function confirm() {
    setError(null);
    setConfirming(true);
    startTransition(async () => {
      const res = await confirmReceptionAction(receptionId);
      if (!res.ok) {
        setError(res.error ?? "No pudimos confirmar la recepción.");
        setConfirming(false);
        return;
      }
      toast(res.message ?? "Inventario actualizado");
      router.push("/dashboard/inventory");
      router.refresh();
    });
  }

  // El ticket dice cuántos artículos trae. Si la suma no cuadra, el OCR se
  // saltó un renglón o leyó uno de más — y es mejor decirlo aquí que dejar que
  // se descubra cuando una clienta pida una pieza que no existe.
  const scanned = items.reduce((s, i) => s + i.quantity, 0);
  const mismatch =
    declaredItems !== null && declaredItems > 0 && scanned !== declaredItems;

  return (
    <div className="pb-44 lg:pb-28">
      {mismatch && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle
            size={16}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-amber-700"
          />
          <p className="text-[13px] leading-relaxed text-amber-900">
            Tu ticket dice <strong>{declaredItems} artículos</strong> y aquí hay{" "}
            <strong>{scanned}</strong>. Revisa si falta un renglón o sobra uno antes de
            confirmar.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong py-10 text-center text-[14px] text-mute">
          Todavía no hay renglones. Agrega los códigos abajo.
        </p>
      ) : (
        <>
          {needsWork.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-amber-800">
                <AlertTriangle size={14} strokeWidth={2} />
                Necesitan tu revisión ({needsWork.length})
              </h2>
              <ul className="space-y-2.5">
                {needsWork.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    categories={categories}
                    disabled={pending}
                    run={run}
                    highlight
                  />
                ))}
              </ul>
            </section>
          )}

          {clean.length > 0 && (
            <section>
              {needsWork.length > 0 && (
                <h2 className="mb-2.5 text-[13px] font-medium text-mute">
                  Listos ({clean.length})
                </h2>
              )}
              <ul className="space-y-2.5">
                {clean.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    categories={categories}
                    disabled={pending}
                    run={run}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <AddByCode receptionId={receptionId} disabled={pending} run={run} />

      {error && <div className="mt-4">
        <ErrorNote>{error}</ErrorNote>
      </div>}

      {/*
        Barra fija con el total y el botón. En el teléfono va en dos filas: en
        375 px, el resumen y los dos botones en un solo renglón dejan el conteo
        partido a la mitad, que es justo el dato que se consulta antes de
        confirmar. En escritorio cabe todo en una fila.
      */}
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-line bg-canvas/95 px-5 py-3 backdrop-blur-xl lg:bottom-0 lg:left-60">
        <div className="mx-auto max-w-5xl lg:flex lg:items-center lg:gap-3">
          <div className="flex items-baseline justify-between gap-3 lg:min-w-0 lg:flex-1">
            <p className="text-[14px] font-medium">
              {totalPieces} {totalPieces === 1 ? "pieza lista" : "piezas listas"}
              {pendingCount > 0 && (
                <span className="ml-2 text-[12px] font-normal text-amber-800">
                  {pendingCount} sin resolver
                </span>
              )}
            </p>
            <button
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  await cancelReception(receptionId);
                  router.push("/dashboard/inventory");
                  router.refresh();
                });
              }}
              disabled={pending}
              className="shrink-0 text-[13px] font-medium text-mute transition-colors hover:text-ink disabled:opacity-40"
            >
              Descartar
            </button>
          </div>

          <Button
            onClick={confirm}
            size="md"
            disabled={pending || confirming || totalPieces === 0}
            className="mt-2 w-full lg:mt-0 lg:w-auto lg:shrink-0"
          >
            {confirming ? "Cargando…" : "Confirmar recepción"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Un renglón -------------------------------------------------------------

function ItemRow({
  item,
  categories,
  disabled,
  run,
  highlight,
}: {
  item: ReceptionItemView;
  categories: { id: number; name: string }[];
  disabled: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => void;
  highlight?: boolean;
}) {
  const [price, setPrice] = useState(
    item.priceCents ? centsToPesosInput(item.priceCents) : ""
  );
  const skipped = item.status === "skipped" || item.quantity === 0;

  return (
    <li
      className={`rounded-2xl border p-3 shadow-card transition-opacity ${
        skipped
          ? "border-line bg-canvas opacity-50"
          : highlight
            ? "border-amber-300 bg-amber-50/40"
            : "border-line bg-surface"
      }`}
    >
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-canvas">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-[9px] tracking-[0.2em] text-mute-soft">
              ?
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">
                {item.name ?? item.nameHint ?? "Producto no encontrado"}
              </p>
              <p className="text-[11px] tabular-nums text-mute">
                {item.niceCode}
                {item.categoryName ? ` · ${item.categoryName}` : ""}
                {item.currentStock !== null && item.currentStock !== undefined
                  ? ` · ya tienes ${item.currentStock}`
                  : ""}
              </p>
            </div>
            <button
              onClick={() => run(() => removeItem(item.id))}
              disabled={disabled}
              className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-mute-soft transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              aria-label={`Quitar ${item.niceCode} de la recepción`}
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>

          {item.confidence === "low" && item.status !== "not_found" && (
            <p className="mt-1.5 rounded-lg bg-amber-100/70 px-2 py-1 text-[11px] leading-snug text-amber-900">
              El código se leyó borroso
              {item.rawLine ? `: “${item.rawLine}”` : ""}. Compáralo con tu ticket.
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex h-9 items-center rounded-lg border border-line-strong bg-surface">
              <button
                onClick={() => run(() => setItemQuantity(item.id, item.quantity - 1))}
                disabled={disabled || item.quantity <= 0}
                className="grid h-full w-8 place-items-center rounded-l-lg text-ink-soft hover:bg-line/50 disabled:opacity-25"
                aria-label="Una menos"
              >
                <Minus size={13} strokeWidth={2.2} />
              </button>
              <span className="w-8 text-center text-[14px] font-medium tabular-nums">
                {item.quantity}
              </span>
              <button
                onClick={() => run(() => setItemQuantity(item.id, item.quantity + 1))}
                disabled={disabled}
                className="grid h-full w-8 place-items-center rounded-r-lg text-ink-soft hover:bg-line/50 disabled:opacity-25"
                aria-label="Una más"
              >
                <Plus size={13} strokeWidth={2.2} />
              </button>
            </div>

            {item.status === "matched" && (
              <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-line-strong bg-surface pl-2.5">
                <span className="text-[13px] text-mute-soft">$</span>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onBlur={() => {
                    const clean = price.trim();
                    if (!clean || clean === centsToPesosInput(item.priceCents ?? 0)) return;
                    run(() => setItemPrice(item.id, clean));
                  }}
                  inputMode="decimal"
                  placeholder="Precio"
                  aria-label={`Precio de ${item.name ?? item.niceCode}`}
                  className="w-full bg-transparent px-1 text-[14px] tabular-nums focus:outline-none"
                />
                {item.priceCents ? (
                  <span className="shrink-0 pr-2.5 text-[11px] text-mute">
                    ×{item.quantity} = {formatMoney(item.priceCents * item.quantity)}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {item.status === "matched" && !item.priceCents && (
            <p className="mt-1.5 text-[11px] text-amber-800">
              Ponle precio o no se cargará.
            </p>
          )}

          {item.status === "not_found" && (
            <ResolveNotFound
              item={item}
              categories={categories}
              disabled={disabled}
              run={run}
            />
          )}
        </div>
      </div>
    </li>
  );
}

// --- Resolver un código que no está en el catálogo --------------------------

function ResolveNotFound({
  item,
  categories,
  disabled,
  run,
}: {
  item: ReceptionItemView;
  categories: { id: number; name: string }[];
  disabled: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => void;
}) {
  const [mode, setMode] = useState<"idle" | "search" | "create">("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogMatch[]>([]);
  const [searching, setSearching] = useState(false);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await findInCatalog(value));
    } finally {
      setSearching(false);
    }
  }

  if (mode === "idle") {
    return (
      <div className="mt-2.5">
        <p className="text-[12px] leading-snug text-amber-900">
          Este código no está en el catálogo NICE.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {/* Primero la tienda de NICE: es donde está la foto de verdad. */}
          <button
            onClick={() => run(() => lookupItemOnNice(item.id))}
            disabled={disabled}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12px] font-medium text-white disabled:opacity-40"
          >
            <Sparkles size={12} strokeWidth={2} />
            Buscar en NICE
          </button>
          <button
            onClick={() => {
              setMode("search");
              search(item.niceCode);
            }}
            disabled={disabled}
            className="h-8 rounded-lg border border-line-strong bg-surface px-3 text-[12px] font-medium"
          >
            En mi catálogo
          </button>
          <button
            onClick={() => setMode("create")}
            disabled={disabled}
            className="h-8 rounded-lg border border-line-strong bg-surface px-3 text-[12px] font-medium"
          >
            Darla de alta
          </button>
        </div>
      </div>
    );
  }

  if (mode === "search") {
    return (
      <div className="mt-2.5 rounded-xl border border-line bg-surface p-2.5">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute-soft"
          />
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Código o nombre"
            autoFocus
            className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-8 text-[13px] focus:border-ink focus:outline-none"
          />
          <button
            onClick={() => setMode("idle")}
            className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-mute hover:bg-line"
            aria-label="Cerrar búsqueda"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>

        <ul className="mt-1.5 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => run(() => linkItemToProduct(item.id, r.id))}
                disabled={disabled}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-line/50 disabled:opacity-40"
              >
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                ) : (
                  <span className="h-9 w-9 rounded-md bg-canvas" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.name}</span>
                  <span className="block text-[11px] tabular-nums text-mute">{r.niceCode}</span>
                </span>
                <Check size={14} strokeWidth={2} className="shrink-0 text-mute-soft" />
              </button>
            </li>
          ))}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <li className="px-2 py-3 text-center text-[12px] text-mute">
              Nada coincide.{" "}
              <button
                onClick={() => setMode("create")}
                className="font-medium text-ink underline underline-offset-2"
              >
                Darlo de alta
              </button>
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <CreateProductInline
      item={item}
      categories={categories}
      onCancel={() => setMode("idle")}
    />
  );
}

function CreateProductInline({
  item,
  categories,
  onCancel,
}: {
  item: ReceptionItemView;
  categories: { id: number; name: string }[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const { createProductForItem } = await import("@/app/dashboard/reception-actions");
      const res = await createProductForItem({ ok: false }, form);
      if (!res.ok) {
        setError(res.error ?? "No pudimos dar de alta la pieza.");
        return;
      }
      toast(res.message ?? "Pieza creada");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-2.5 space-y-2 rounded-xl border border-line bg-surface p-2.5">
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="niceCode" value={item.niceCode} />

      {/* Prellenado con lo que venía impreso: la descripción del ticket y su
          precio de catálogo. Casi siempre solo hay que afinar el nombre. */}
      <input
        name="name"
        placeholder="Nombre de la pieza"
        defaultValue={item.nameHint ?? ""}
        required
        maxLength={120}
        autoFocus
        className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] focus:border-ink focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="price"
          placeholder="Tu precio"
          defaultValue={
            item.catalogPriceCents ? centsToPesosInput(item.catalogPriceCents) : ""
          }
          inputMode="decimal"
          required
          maxLength={12}
          className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] focus:border-ink focus:outline-none"
        />
        <select
          name="categoryId"
          defaultValue=""
          className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-[13px] focus:border-ink focus:outline-none"
        >
          <option value="">Categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <input
        name="imageUrl"
        placeholder="Enlace de la foto (opcional)"
        inputMode="url"
        maxLength={500}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] focus:border-ink focus:outline-none"
      />

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 flex-1 rounded-lg bg-ink text-[13px] font-medium text-white disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Dar de alta"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-line-strong px-3 text-[13px] font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// --- Agregar un código a mano -----------------------------------------------

function AddByCode({
  receptionId,
  disabled,
  run,
}: {
  receptionId: number;
  disabled: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => void;
}) {
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("1");

  function add() {
    const c = code.trim();
    if (!c) return;
    run(async () => {
      const res = await addManualItem(receptionId, c, Number(quantity) || 1);
      if (res.ok) {
        setCode("");
        setQuantity("1");
      }
      return res;
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-dashed border-line-strong p-3">
      <p className="mb-2 text-[12px] font-medium text-mute">Agregar un código a mano</p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="826031"
          autoCapitalize="characters"
          autoCorrect="off"
          maxLength={20}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-[14px] tabular-nums focus:border-ink focus:outline-none"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && add()}
          inputMode="numeric"
          maxLength={3}
          aria-label="Cantidad"
          className="h-10 w-16 rounded-xl border border-line-strong bg-surface px-3 text-center text-[14px] tabular-nums focus:border-ink focus:outline-none"
        />
        <button
          onClick={add}
          disabled={disabled || !code.trim()}
          className="h-10 shrink-0 rounded-xl bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-30"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
