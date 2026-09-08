"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { createSale, type ActionState } from "@/app/dashboard/actions";
import { PAYMENT_METHODS } from "@/lib/payments";
import type { InventoryItem } from "@/lib/seller";
import { formatMoney, pesosToCents } from "@/lib/format";
import { discountFor } from "@/lib/loyalty-rules";
import { Button, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Registrar una venta fisica.
 *
 * El total se calcula en pantalla mientras se arma —es lo que la
 * distribuidora le va a decir a su clienta en voz alta— pero el que se guarda
 * lo vuelve a calcular el servidor con los precios de la base. Los dos
 * coinciden salvo que alguien haya cambiado un precio a media captura, y en
 * ese caso el bueno es el del servidor.
 */
export function SaleForm({
  items,
  prefill,
  orderId,
  contact,
  coupon,
}: {
  items: InventoryItem[];
  prefill: { inventoryId: number; quantity: number }[];
  orderId: number | null;
  contact: { name: string; phone: string } | null;
  /** El cupon que traia el pedido, si traia uno. */
  coupon: { code: string; name: string; kind: string; value: number } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(createSale, { ok: false });

  const [lines, setLines] = useState<Record<number, number>>(() =>
    Object.fromEntries(prefill.map((p) => [p.inventoryId, p.quantity]))
  );
  const [query, setQuery] = useState("");
  const [payMode, setPayMode] = useState<"completo" | "abonos">("completo");
  const [downPayment, setDownPayment] = useState("");

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.push("/dashboard/sales");
    }
  }, [state, router, toast]);

  const byId = useMemo(() => new Map(items.map((i) => [i.inventoryId, i])), [items]);

  const chosen = Object.entries(lines)
    .map(([id, qty]) => ({ item: byId.get(Number(id))!, quantity: qty }))
    .filter((l) => l.item && l.quantity > 0);

  const subtotalCents = chosen.reduce((s, l) => s + l.item.priceCents * l.quantity, 0);

  // El descuento se enseña aqui, pero el que se cobra lo vuelve a calcular el
  // servidor con el cupon leido de la base.
  const discountCents = coupon
    ? discountFor(coupon.kind, coupon.value, subtotalCents)
    : 0;
  const totalCents = subtotalCents - discountCents;

  // El saldo se enseña mientras escribe el anticipo. El que vale lo calcula el
  // servidor con el total que él mismo armó.
  const downCents = pesosToCents(downPayment) ?? 0;
  const balanceCents = payMode === "abonos" ? Math.max(0, totalCents - downCents) : 0;

  const results = query.trim()
    ? items.filter((i) => {
        const needle = query.trim().toLowerCase();
        return (
          i.name.toLowerCase().includes(needle) || i.niceCode.toLowerCase().includes(needle)
        );
      })
    : items.slice(0, 8);

  function setQty(inventoryId: number, quantity: number) {
    const item = byId.get(inventoryId);
    if (!item) return;
    const capped = Math.max(0, Math.min(quantity, item.stock));
    setLines((prev) => {
      const next = { ...prev };
      if (capped === 0) delete next[inventoryId];
      else next[inventoryId] = capped;
      return next;
    });
  }

  return (
    <form action={action} className="max-w-lg space-y-6">
      {orderId && <input type="hidden" name="orderId" value={orderId} />}

      <section>
        <p className="mb-2 text-[13px] font-medium text-ink-soft">Piezas vendidas</p>

        {chosen.length > 0 && (
          <ul className="mb-3 space-y-2">
            {chosen.map(({ item, quantity }) => (
              <li
                key={item.inventoryId}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <input type="hidden" name="inventoryId" value={item.inventoryId} />
                <input type="hidden" name="quantity" value={quantity} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{item.name}</p>
                  <p className="text-[11px] tabular-nums text-mute">
                    {item.niceCode} · {formatMoney(item.priceCents)} c/u · tienes {item.stock}
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
                    disabled={quantity >= item.stock}
                    className="grid h-full w-8 place-items-center rounded-r-lg text-ink-soft hover:bg-line/50 disabled:opacity-25"
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
                  disabled={already >= item.stock}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-line/50 disabled:opacity-40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.name}</p>
                    <p className="text-[11px] tabular-nums text-mute">
                      {item.niceCode} · {item.stock}{" "}
                      {item.stock === 1 ? "disponible" : "disponibles"}
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
        {discountCents > 0 && (
          <>
            <div className="flex items-baseline justify-between text-[13px] text-white/60">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(subtotalCents)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-[13px] text-gold">
              <span className="truncate pr-3">
                Cupón {coupon?.code} · {coupon?.name}
              </span>
              <span className="shrink-0 tabular-nums">−{formatMoney(discountCents)}</span>
            </div>
            <div className="my-3 border-t border-white/10" />
          </>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-[14px]">Total de la venta</span>
          <span className="text-[22px] font-medium tabular-nums">{formatMoney(totalCents)}</span>
        </div>

        {balanceCents > 0 && (
          <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3 text-[13px]">
            <span className="text-white/60">Queda debiendo</span>
            <span className="font-medium tabular-nums text-amber-300">
              {formatMoney(balanceCents)}
            </span>
          </div>
        )}
      </div>

      {/*
        Cómo se está pagando.

        Un apartado descuenta el inventario igual que una venta —la pieza ya se
        guardó para esa clienta y nadie más se la puede llevar—; lo que queda
        abierto es el cobro. Por eso es un modo de la misma pantalla y no un
        formulario aparte: para ella es la misma operación.
      */}
      <section>
        <div className="mb-3 flex overflow-hidden rounded-xl border border-line-strong">
          {(
            [
              ["completo", "Paga todo"],
              ["abonos", "A abonos"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPayMode(mode)}
              className={`h-11 flex-1 text-[14px] font-medium transition-colors ${
                payMode === mode ? "bg-ink text-white" : "text-ink-soft hover:bg-canvas"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="payMode" value={payMode} />

        {payMode === "abonos" && (
          <div className="animate-fade-up space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Anticipo"
                hint={
                  balanceCents > 0
                    ? `Le quedan ${formatMoney(balanceCents)} por pagar.`
                    : "Lo que te deja hoy."
                }
              >
                <Input
                  name="downPayment"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  maxLength={12}
                />
              </Field>
              <Field label="Fecha límite" hint="Opcional, para acordarte de cobrar.">
                <Input name="dueDate" type="date" />
              </Field>
            </div>
            <p className="text-[12px] leading-relaxed text-mute">
              Las piezas salen de tu inventario desde ahora: quedan apartadas. Los puntos se le
              abonan cuando termine de pagar.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <Field
          label="Cliente"
          hint={
            payMode === "abonos"
              ? "Obligatorio en una venta a abonos: es a quien vas a cobrarle."
              : "Opcional. Si lo registras, acumula puntos y aparece en tu cartera."
          }
        >
          <Input
            name="customerName"
            placeholder="María López"
            defaultValue={contact?.name ?? ""}
            required={payMode === "abonos"}
            maxLength={80}
          />
        </Field>

        <Field label="Teléfono del cliente">
          <Input
            name="customerPhone"
            placeholder="656 123 4567"
            inputMode="tel"
            defaultValue={contact?.phone ?? ""}
            required={payMode === "abonos"}
            maxLength={20}
          />
        </Field>

        <Field label={payMode === "abonos" ? "Cómo te dejó el anticipo" : "Forma de pago"}>
          <Select name="paymentMethod" defaultValue="efectivo">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nota">
          <Textarea name="note" rows={2} maxLength={300} placeholder="Opcional" />
        </Field>
      </section>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <Button type="submit" size="lg" disabled={pending || chosen.length === 0} className="w-full">
        {pending
          ? "Registrando…"
          : payMode === "abonos"
            ? "Registrar apartado"
            : "Registrar venta"}
      </Button>
    </form>
  );
}
