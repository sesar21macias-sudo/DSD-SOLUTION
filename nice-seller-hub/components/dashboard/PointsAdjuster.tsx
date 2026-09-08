"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { adjustPointsAction, type LoyaltyState } from "@/app/dashboard/loyalty/actions";
import { ErrorNote, Input } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Sumar o restar puntos a mano.
 *
 * Existe porque la realidad no cabe en las reglas: una venta que se registro
 * mal, un detalle por su cumpleaños, una disculpa por un pedido que se
 * retraso. El signo se elige con un boton y no escribiendo "-200", que es
 * donde se equivoca cualquiera.
 *
 * Todo ajuste queda escrito en los movimientos con su motivo.
 */
export function PointsAdjuster({ customerId }: { customerId: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");

  const [state, action, pending] = useActionState<LoyaltyState, FormData>(adjustPointsAction, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      setAmount("");
      router.refresh();
    }
  }, [state, router, toast]);

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="delta" value={sign * (Number(amount) || 0)} />

      <p className="text-[13px] font-medium">Ajustar puntos</p>

      {/*
        `flex-wrap` en vez de una fila fija: el motivo es el campo que mas
        espacio necesita, y en una pantalla angosta el toggle mas la cantidad
        ya no le dejan sitio en la misma fila. Con `min-w` y `flex-1` baja solo
        a su propio renglon en vez de desbordar la tarjeta hacia la derecha.
      */}
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-line-strong">
          <button
            type="button"
            onClick={() => setSign(1)}
            className={`grid h-11 w-11 place-items-center transition-colors ${
              sign === 1 ? "bg-ink text-white" : "text-mute hover:bg-canvas"
            }`}
            aria-label="Sumar"
          >
            <Plus size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setSign(-1)}
            className={`grid h-11 w-11 place-items-center border-l border-line-strong transition-colors ${
              sign === -1 ? "bg-ink text-white" : "text-mute hover:bg-canvas"
            }`}
            aria-label="Restar"
          >
            <Minus size={16} strokeWidth={2.2} />
          </button>
        </div>

        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Puntos"
          inputMode="numeric"
          maxLength={6}
          className="w-28 shrink-0"
        />

        <Input
          name="reason"
          placeholder="Motivo (ej. cumpleaños)"
          maxLength={120}
          className="min-w-[180px] flex-1"
        />
      </div>

      {state.error && (
        <div className="mt-3">
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !amount}
        className="mt-3 h-10 w-full rounded-xl bg-ink text-[14px] font-medium text-white transition-all hover:bg-ink-soft active:scale-[0.99] disabled:opacity-40"
      >
        {pending ? "Aplicando…" : sign === 1 ? "Sumar puntos" : "Restar puntos"}
      </button>
    </form>
  );
}
