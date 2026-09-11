"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { updateOrderContact, updateOrderItemsAction } from "@/app/dashboard/actions";
import type { OrderDetail } from "@/lib/seller";
import type { InventoryItem } from "@/lib/seller";
import { formatMoney } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Editar un pedido antes de convertirlo en venta.
 *
 * Un pedido no mueve inventario, así que aquí se puede agregar, quitar o
 * cambiar cantidades libremente — lo único que se guarda es lo que ella va a
 * ver (y confirmar) al registrar la venta. Las piezas que ya no están en su
 * inventario se ven pero no se pueden tocar: no hay a qué precio venderlas.
 */
export function EditOrderForm({ order, items }: { order: OrderDetail; items: InventoryItem[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(order.contactName ?? "");
  const [phone, setPhone] = useState(order.contactPhone ? displayPhone(order.contactPhone) : "");
  const [savingContact, startSavingContact] = useTransition();

  const [lines, setLines] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      order.items.filter((it) => it.inventoryId !== null).map((it) => [it.inventoryId as number, it.quantity])
    )
  );
  const missingItems = order.items.filter((it) => it.inventoryId === null);
  const [query, setQuery] = useState("");
  const [savingItems, startSavingItems] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const closed = order.status === "delivered" || order.status === "cancelled";

  const byId = useMemo(() => new Map(items.map((i) => [i.inventoryId, i])), [items]);
  const chosen = Object.entries(lines)
    .map(([id, qty]) => ({ item: byId.get(Number(id)), quantity: qty }))
    .filter((l): l is { item: InventoryItem; quantity: number } => !!l.item && l.quantity > 0);

  const subtotalCents = chosen.reduce((s, l) => s + l.item.priceCents * l.quantity, 0);

  const results = query.trim()
    ? items.filter((i) => {
        const needle = query.trim().toLowerCase();
        return i.name.toLowerCase().includes(needle) || i.niceCode.toLowerCase().includes(needle);
      })
    : items.slice(0, 8);

  function setQty(inventoryId: number, quantity: number) {
    const capped = Math.max(0, Math.min(quantity, 99));
    setLines((prev) => {
      const next = { ...prev };
      if (capped === 0) delete next[inventoryId];
      else next[inventoryId] = capped;
      return next;
    });
  }

  function saveContact() {
    startSavingContact(async () => {
      const res = await updateOrderContact(order.id, name, phone);
      toast(res.error ?? res.message ?? "Listo", res.error ? "error" : undefined);
      if (res.ok) router.refresh();
    });
  }

  function saveItems() {
    setError(null);
    startSavingItems(async () => {
      const payload = Object.entries(lines).map(([inventoryId, quantity]) => ({
        inventoryId: Number(inventoryId),
        quantity,
      }));
      const res = await updateOrderItemsAction(order.id, payload);
      if (!res.ok) {
        setError(res.error ?? "No pudimos guardar el pedido.");
        return;
      }
      toast(res.message ?? "Pedido actualizado");
      router.refresh();
    });
  }

  if (closed) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center">
        <p className="text-[14px] text-mute">
          Este pedido ya está {order.status === "delivered" ? "entregado" : "cancelado"} y no se
          puede editar.
        </p>
        <Link
          href="/dashboard/orders"
          className="mt-3 inline-block text-[13px] font-medium underline underline-offset-4"
        >
          Volver a Pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <section className="space-y-3">
        <p className="text-[13px] font-medium text-ink-soft">Cliente</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la clienta"
            maxLength={80}
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Su WhatsApp"
            inputMode="tel"
            maxLength={20}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={saveContact}
          disabled={savingContact || !name.trim() || !phone.trim()}
        >
          {savingContact ? "Guardando…" : "Guardar cliente"}
        </Button>
      </section>

      <section>
        <p className="mb-2 text-[13px] font-medium text-ink-soft">Piezas del pedido</p>

        {missingItems.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {missingItems.map((it, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-strong bg-canvas p-3 text-mute"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{it.name}</p>
                  <p className="text-[11px] tabular-nums">{it.code} · ya no está en tu inventario</p>
                </div>
                <span className="shrink-0 text-[12px] tabular-nums">×{it.quantity}</span>
              </li>
            ))}
          </ul>
        )}

        {chosen.length > 0 && (
          <ul className="mb-3 space-y-2">
            {chosen.map(({ item, quantity }) => (
              <li
                key={item.inventoryId}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-line-strong text-[9px] text-mute-soft">
                    Sin foto
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{item.name}</p>
                  <p className="text-[11px] tabular-nums text-mute">
                    {item.niceCode} · {formatMoney(item.priceCents)} c/u
                    {item.stock === 0 && (
                      <span className="text-amber-600"> · agotada, no se podrá vender así</span>
                    )}
                  </p>
                </div>

                <div className="flex h-9 shrink-0 items-center rounded-lg border border-line-strong">
                  <button
                    type="button"
                    onClick={() => setQty(item.inventoryId, quantity - 1)}
                    className="grid h-full w-8 place-items-center rounded-l-lg text-ink-soft hover:bg-line/50"
                    aria-label="Quitar una"
                  >
                    <Minus size={13} strokeWidth={2.2} />
                  </button>
                  <span className="w-7 text-center text-[13px] font-medium tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(item.inventoryId, quantity + 1)}
                    className="grid h-full w-8 place-items-center rounded-r-lg text-ink-soft hover:bg-line/50"
                    aria-label="Agregar una"
                  >
                    <Plus size={13} strokeWidth={2.2} />
                  </button>
                </div>

                <span className="w-20 shrink-0 text-right text-[14px] font-medium tabular-nums">
                  {formatMoney(item.priceCents * quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-soft"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pieza o código NICE"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-9 text-[15px] placeholder:text-mute-soft focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-mute hover:bg-line"
              aria-label="Limpiar"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {results.map((item) => {
            const already = lines[item.inventoryId] ?? 0;
            return (
              <li key={item.inventoryId}>
                <button
                  type="button"
                  onClick={() => setQty(item.inventoryId, already + 1)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-line/50"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-dashed border-line-strong text-[8px] text-mute-soft">
                      Sin foto
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.name}</p>
                    <p className="text-[11px] tabular-nums text-mute">
                      {item.niceCode}
                      {item.stock === 0 && " · agotada"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-mute">
                    {formatMoney(item.priceCents)}
                  </span>
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="py-4 text-center text-[13px] text-mute">Nada coincide.</li>
          )}
        </ul>
      </section>

      <div className="rounded-2xl bg-ink px-5 py-4 text-white">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px]">Total del pedido</span>
          <span className="text-[22px] font-medium tabular-nums">{formatMoney(subtotalCents)}</span>
        </div>
        {order.discountCents > 0 && (
          <p className="mt-1 text-[12px] text-white/60">
            El cupón que trae este pedido se vuelve a aplicar al guardar.
          </p>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex gap-2.5">
        <Button
          type="button"
          size="lg"
          onClick={saveItems}
          disabled={savingItems || chosen.length === 0}
          className="flex-1"
        >
          {savingItems ? "Guardando…" : "Guardar piezas"}
        </Button>
        <Link
          href={`/dashboard/sales/new?order=${order.id}`}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-line-strong px-5 text-[14px] font-medium transition-colors hover:border-ink/25"
        >
          Registrar venta
        </Link>
      </div>
    </div>
  );
}
