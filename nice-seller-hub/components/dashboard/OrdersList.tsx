"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { setOrderStatus } from "@/app/dashboard/actions";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  type OrderStatus,
} from "@/lib/order-status";
import type { OrderSummary } from "@/lib/seller";
import { formatDateTime, formatMoney } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
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
          <li key={o.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{o.contactName ?? "Cliente sin nombre"}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-mute">
                  {o.orderNumber} · {formatDateTime(o.createdAt)}
                </p>
                <p className="mt-0.5 text-[12px] text-mute">
                  {o.itemCount} {o.itemCount === 1 ? "pieza" : "piezas"}
                </p>
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

            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
              <select
                value={o.status}
                onChange={(e) => change(o.id, e.target.value)}
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
        ))}
      </ul>
    </div>
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
