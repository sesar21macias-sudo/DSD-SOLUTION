"use client";

import { useEffect, useState } from "react";
import { Clock, RotateCw, TriangleAlert } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";

/**
 * "Te las apartamos 14:32".
 *
 * Es la única forma honesta de cobrar el apartado: si le retenemos una pieza a
 * alguien más mientras esta persona decide, esta persona tiene que saber que su
 * turno se acaba. Un apartado silencioso que expira sin avisar es peor que no
 * tener apartado — la clienta vuelve, encuentra su carrito vacío de contenido
 * real y no entiende qué pasó.
 *
 * El reloj corre en el navegador, pero el que manda es el del servidor: al
 * llegar a cero no se suelta nada desde aquí, solo se pide renovar y el
 * servidor contesta con la verdad.
 */

const MINUTE = 60_000;
/** Debajo de esto el aviso deja de ser informativo y se pone urgente. */
const WARNING_MS = 3 * MINUTE;

function remaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Number.isNaN(ms) ? null : ms;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function HoldNotice({ className = "" }: { className?: string }) {
  const { holdExpiresAt, holdProblems, renewHold, count } = useCart();
  const [ms, setMs] = useState<number | null>(() => remaining(holdExpiresAt));

  useEffect(() => {
    setMs(remaining(holdExpiresAt));
    if (!holdExpiresAt) return;

    const id = setInterval(() => setMs(remaining(holdExpiresAt)), 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  if (count === 0) return null;

  // Lo que otra persona alcanzó a llevarse va primero: es lo único que cambia
  // lo que esta clienta creía que iba a comprar.
  if (holdProblems.length > 0) {
    return (
      <div
        className={`animate-fade-up rounded-2xl border border-amber-200 bg-amber-50/80 p-4 ${className}`}
      >
        <p className="flex items-center gap-2 text-[13px] font-medium text-amber-900">
          <TriangleAlert size={14} strokeWidth={2} />
          Ajustamos tu pedido
        </p>
        <ul className="mt-1.5 space-y-1">
          {holdProblems.map((p) => (
            <li key={p.niceCode} className="text-[13px] leading-relaxed text-amber-900/85">
              {p.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (ms === null) return null;

  const expired = ms <= 0;
  const urgent = ms <= WARNING_MS;

  if (expired) {
    return (
      <div
        className={`animate-fade-up flex items-center gap-3 rounded-2xl border border-line-strong bg-surface p-4 ${className}`}
      >
        <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-soft">
          Se acabó el tiempo que te apartamos las piezas. Vuelve a apartarlas para seguir.
        </span>
        <button
          onClick={renewHold}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-white transition-transform active:scale-[0.97]"
        >
          <RotateCw size={13} strokeWidth={2} />
          Apartar
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 transition-colors ${
        urgent
          ? "border-amber-200 bg-amber-50/80 text-amber-900"
          : "border-line bg-surface text-ink-soft"
      } ${className}`}
    >
      <Clock size={14} strokeWidth={1.9} className="shrink-0 opacity-70" />
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        {urgent ? "Se te acaba el tiempo: " : "Te las apartamos por "}
        <span className="font-medium tabular-nums">{clock(ms)}</span>
        {urgent ? " para terminar tu pedido." : ". Nadie más puede llevárselas mientras tanto."}
      </p>
    </div>
  );
}
