"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Search, Ticket } from "lucide-react";
import {
  cancelRedemptionAction,
  markRedemptionUsedAction,
  type LoyaltyState,
} from "@/app/dashboard/loyalty/actions";
import { formatDate } from "@/lib/format";
import { maskPhone } from "@/lib/phone";
import { useToast } from "@/components/Toast";

/**
 * Los cupones canjeados.
 *
 * La tarea real es una: alguien llega con un codigo y hay que decir si vale.
 * Por eso hay un buscador arriba —se teclean tres letras del codigo y aparece—
 * y por eso los vigentes salen primero.
 */

interface Row {
  id: number;
  code: string;
  nameSnapshot: string;
  kind: string;
  value: number;
  pointsSpent: number;
  status: string;
  createdAt: string;
  usedAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
}

export function RedemptionList({ redemptions }: { redemptions: Row[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");

  function run(fn: () => Promise<LoyaltyState>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast(result.error);
      else if (result.message) toast(result.message);
      router.refresh();
    });
  }

  const needle = q.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const filtered = needle
    ? redemptions.filter(
        (r) =>
          r.code.toLowerCase().replace(/[^a-z0-9]/g, "").includes(needle) ||
          (r.customerName ?? "").toLowerCase().includes(q.trim().toLowerCase())
      )
    : redemptions;

  // Los vigentes primero: son los unicos que piden una decision.
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === "available" ? -1 : 1;
  });

  if (redemptions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-[13px] leading-relaxed text-mute">
        Nadie ha canjeado puntos todavía.
        <br />
        Cuando lo hagan, sus cupones aparecen aquí.
      </p>
    );
  }

  return (
    <>
      <div className="relative mb-3">
        <Search
          size={16}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-soft"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca el código o el nombre"
          className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-10 pr-3.5 text-[15px] placeholder:text-mute-soft focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5"
        />
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[13px] text-mute">
          Ningún cupón coincide con “{q}”.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {sorted.map((r) => {
            const active = r.status === "available";
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    active ? "bg-ink text-white" : "bg-canvas text-mute-soft"
                  }`}
                >
                  {active ? (
                    <Ticket size={17} strokeWidth={1.6} />
                  ) : (
                    <Check size={17} strokeWidth={1.8} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium tabular-nums">{r.code}</p>
                  <p className="truncate text-[11px] text-mute">
                    {r.nameSnapshot} · {r.customerName ?? "Cliente"}
                    {r.customerPhone ? ` · ${maskPhone(r.customerPhone)}` : ""}
                  </p>
                  <p className="text-[11px] text-mute-soft">
                    {active
                      ? `Canjeado el ${formatDate(r.createdAt)}`
                      : r.status === "used"
                        ? `Usado el ${formatDate(r.usedAt ?? r.createdAt)}`
                        : "Cancelado"}
                  </p>
                </div>

                {active && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => run(() => markRedemptionUsedAction(r.id))}
                      disabled={pending}
                      className="h-9 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-white transition-all hover:bg-ink-soft active:scale-[0.97] disabled:opacity-40"
                    >
                      Usado
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `¿Cancelar este cupón? Le devolvemos sus ${r.pointsSpent} puntos.`
                          )
                        ) {
                          run(() => cancelRedemptionAction(r.id));
                        }
                      }}
                      disabled={pending}
                      className="h-9 rounded-lg px-2.5 text-[13px] text-mute transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
