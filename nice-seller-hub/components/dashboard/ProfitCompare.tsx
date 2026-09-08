import { formatMoney, formatNumber } from "@/lib/format";

/**
 * Ganancia real contra ganancia proyectada.
 *
 * Son dos preguntas distintas y por eso no se pueden sumar como si fueran la
 * misma cosa: la real contesta "cuánto ya gané" en un periodo (lo que se
 * vendió); la proyectada contesta "cuánto ganaría" en este instante si
 * vendiera todo lo que tiene guardado ahora mismo. Una mira hacia atrás, la
 * otra mira el cajón. Por eso el texto lo dice explícito en vez de dejar que
 * las dos barras parezcan la misma unidad de tiempo.
 */
export function ProfitCompare({
  realCents,
  projectedCents,
  rangeLabel,
  hasRealData,
  hasProjectedData,
}: {
  /** Ganancia de lo ya vendido en el rango seleccionado. */
  realCents: number;
  /** Ganancia si vendiera hoy todo su inventario actual. */
  projectedCents: number;
  /** "en los últimos 30 días", "hoy", etc. — ya con su propio conector. */
  rangeLabel: string;
  /** false si ninguna venta del rango tiene costo capturado. */
  hasRealData: boolean;
  /** false si ninguna pieza del inventario tiene costo capturado. */
  hasProjectedData: boolean;
}) {
  if (!hasRealData && !hasProjectedData) return null;

  const max = Math.max(realCents, projectedCents, 1);
  const realPct = Math.round((realCents / max) * 100);
  const projectedPct = Math.round((projectedCents / max) * 100);

  // Cuánto de lo que podría ganar ya lo ganó de verdad: la unica cifra que
  // combina las dos, y solo tiene sentido cuando las dos existen.
  const total = realCents + projectedCents;
  const realizedPct =
    hasRealData && hasProjectedData && total > 0
      ? Math.round((realCents / total) * 100)
      : null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="space-y-4">
        <Bar
          label={`Ganancia real · ${rangeLabel}`}
          value={hasRealData ? formatMoney(realCents) : "—"}
          pct={hasRealData ? realPct : 0}
          className="bg-ink"
        />
        <Bar
          label="Ganancia proyectada · si vendieras todo hoy"
          value={hasProjectedData ? formatMoney(projectedCents) : "—"}
          pct={hasProjectedData ? projectedPct : 0}
          className="bg-gold"
        />
      </div>

      {realizedPct !== null && (
        <p className="mt-4 border-t border-line pt-3.5 text-[12px] leading-relaxed text-mute">
          Ya realizaste el <span className="font-medium text-ink">{formatNumber(realizedPct)}%</span>{" "}
          de la ganancia que tienes guardada en tu inventario actual. El resto —
          {formatMoney(projectedCents)}
          — está en las piezas que todavía no vendes.
        </p>
      )}

      {(!hasRealData || !hasProjectedData) && (
        <p className="mt-4 border-t border-line pt-3.5 text-[12px] leading-relaxed text-mute">
          {!hasRealData &&
            "Todavía no hay ventas costeadas en este periodo. "}
          {!hasProjectedData &&
            "Tu inventario actual no tiene costos capturados. "}
          Se llenan solos con tu descuento de distribuidora en tus próximas recepciones.
        </p>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  pct,
  className,
}: {
  label: string;
  value: string;
  pct: number;
  className: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-soft">{label}</span>
        <span className="shrink-0 text-[14px] font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${className}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}
