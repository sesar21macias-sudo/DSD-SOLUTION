"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageCircle, Pencil } from "lucide-react";
import { setOrderStatus, updateOrderContact } from "@/app/dashboard/actions";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  type OrderStatus,
} from "@/lib/order-status";
import type { OrderSummary } from "@/lib/seller";
import { formatDateTime, formatMoney } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Input } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Los pedidos con su estado editable.
 *
 * El filtro por estado vive en el cliente porque la lista viene acotada a 100:
 * ir al servidor por cada toque de una pestaña seria mas lento y no cambiaria
 * lo que se ve.
 */
export function OrdersList({ orders }: { orders: OrderSummary[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const counts = ORDER_STATUSES.map((s) => ({
    status: s,
    count: orders.filter((o) => o.status === s).length,
  })).filter((c) => c.count > 0);

  function change(orderId: number, status: string) {
    startTransition(async () => {
      const res = await setOrderStatus(orderId, status);
      if (!res.ok) toast(res.error ?? "No pudimos actualizar el pedido.", "error");
      else toast("Pedido actualizado");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
        <Tab active={filter === "all"} onClick={() => setFilter("all")}>
          Todos <span className="opacity-50">{orders.length}</span>
        </Tab>
        {counts.map((c) => (
          <Tab key={c.status} active={filter === c.status} onClick={() => setFilter(c.status)}>
            {ORDER_STATUS_LABELS[c.status]} <span className="opacity-50">{c.count}</span>
          </Tab>
        ))}
      </div>

      <ul className={`space-y-2.5 transition-opacity ${pending ? "opacity-60" : ""}`}>
        {visible.map((o) => (
          <OrderCard key={o.id} order={o} onStatusChange={change} />
        ))}
      </ul>
    </div>
  );
}

function OrderCard({
  order: o,
  onStatusChange,
}: {
  order: OrderSummary;
  onStatusChange: (orderId: number, status: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();
  const [name, setName] = useState(o.contactName ?? "");
  const [phone, setPhone] = useState(o.contactPhone ? displayPhone(o.contactPhone) : "");

  function save() {
    startSaving(async () => {
      const res = await updateOrderContact(o.id, name, phone);
      if (!res.ok) {
        toast(res.error ?? "No pudimos guardar al cliente.", "error");
        return;
      }
      toast("Cliente actualizado");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la clienta"
                maxLength={80}
                className="h-9"
              />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Su WhatsApp"
                inputMode="tel"
                maxLength={20}
                className="h-9"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !name.trim() || !phone.trim()}
                  className="h-8 rounded-lg bg-ink px-3 text-[12px] font-medium text-white disabled:opacity-40"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setName(o.contactName ?? "");
                    setPhone(o.contactPhone ? displayPhone(o.contactPhone) : "");
                  }}
                  className="h-8 rounded-lg px-3 text-[12px] font-medium text-mute hover:bg-canvas"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group flex items-center gap-1.5 text-left"
            >
              <p className="text-[15px] font-medium">{o.contactName ?? "Cliente sin nombre"}</p>
              <Pencil
                size={12}
                strokeWidth={2}
                className="shrink-0 text-mute-soft opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          )}
          {!editing && (
            <p className="mt-0.5 text-[11px] tabular-nums text-mute">
              {o.orderNumber} · {formatDateTime(o.createdAt)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[17px] font-medium tabular-nums">{formatMoney(o.totalCents)}</p>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              ORDER_STATUS_STYLES[o.status as OrderStatus]
            }`}
          >
            {ORDER_STATUS_LABELS[o.status as OrderStatus]}
          </span>
        </div>
      </div>

      {/* Las fotos son para encontrar la pieza física rápido, no para lucir
          bonitas — por eso van chicas y en fila, como una lista de empaque,
          en vez de una galería. */}
      <ul className="mt-3 space-y-1.5">
        {o.items.map((it, i) => (
          <li key={i} className="flex items-center gap-2.5">
            {it.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.imageUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
              />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashed border-line-strong text-[9px] text-mute-soft">
                Sin foto
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px]">{it.name}</p>
              <p className="text-[11px] tabular-nums text-mute">{it.code}</p>
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-mute">×{it.quantity}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
        <select
          value={o.status}
          onChange={(e) => onStatusChange(o.id, e.target.value)}
          className="h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] focus:border-ink focus:outline-none"
          aria-label="Cambiar estado del pedido"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {o.contactPhone && (
          <a
            href={`https://wa.me/${o.contactPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-[13px] font-medium text-white transition-transform active:scale-[0.98]"
          >
            <MessageCircle size={14} strokeWidth={2} />
            {displayPhone(o.contactPhone)}
          </a>
        )}

        <Link
          href={`/dashboard/sales/new?order=${o.id}`}
          className="ml-auto inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[13px] font-medium text-white transition-transform active:scale-[0.98]"
        >
          Registrar venta
        </Link>
      </div>
    </li>
  );
}

function Tab({
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
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-ink text-white" : "border border-line-strong bg-surface text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}
