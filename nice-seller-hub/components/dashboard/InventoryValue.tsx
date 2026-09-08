"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Calculator } from "lucide-react";
import { fillCostsAction } from "@/app/dashboard/actions";
import { formatMoney, formatNumber } from "@/lib/format";
import type { InventoryValuation } from "@/lib/seller";
import { useToast } from "@/components/Toast";

/**
 * Cuánto vale lo que tiene guardado.
 *
 * Cuatro cifras y una comparación: lo que invirtió, lo que vale a precio de
 * catálogo NICE, lo que se llevaría si lo vendiera todo a su precio, y la
 * diferencia. Es la pregunta que se hace mirando su cajón —"cuánto tengo
 * aquí"— y hasta ahora el sistema solo sabía contestar en piezas.
 *
 * Las piezas sin costo se dicen en voz alta en lugar de asumirles cero. Un
 * cero las haría ver como ganancia pura e inflaría el número más importante de
 * la tarjeta.
 */
export function InventoryValue({
  valuation,
  discountPct,
  className = "",
}: {
  valuation: InventoryValuation;
  discountPct: number;
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  // Piezas, no renglones: es la unidad que usa el resto de la tarjeta ("25 pzs
  // costeadas"), y decir "faltan 7" cuando son 7 modelos y 35 piezas confunde.
  const missing = valuation.pieces - valuation.piecesWithCost;
  const hasCost = valuation.linesWithCost > 0;

  // El margen se calcula solo sobre lo costeado. Dividir entre el valor de todo
  // el inventario metía en el divisor piezas que no aportan a la ganancia y
  // devolvía un margen muy por debajo del real.
  const margin =
    hasCost && valuation.retailWithCostCents > 0
      ? Math.round((valuation.projectedProfitCents / valuation.retailWithCostCents) * 100)
      : null;

  /**
   * La diferencia entre su precio y el de catálogo.
   *
   * Casi siempre es cero: al recibir mercancía el precio se prellena con el de
   * catálogo y pocas lo cambian. Cuando eso pasa, las dos columnas mostraban el
   * mismo número sin explicar por qué —que es exactamente la duda que provoca—.
   * Ahora la propia tarjeta lo dice.
   */
  const delta = valuation.retailCents - valuation.catalogCents;

  const priceHint =
    delta === 0
      ? "Vendes al precio de catálogo"
      : delta > 0
        ? `${formatMoney(delta)} por encima del catálogo`
        : `${formatMoney(Math.abs(delta))} por debajo del catálogo`;

  function fillCosts() {
    startTransition(async () => {
      const res = await fillCostsAction();
      toast(res.error ?? res.message ?? "Listo", res.error ? "error" : undefined);
      router.refresh();
    });
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-card ${className}`}
    >
      <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        <Cell
          label="Invertido"
          value={hasCost ? formatMoney(valuation.costCents) : "—"}
          hint={hasCost ? `${formatNumber(valuation.piecesWithCost)} pzs costeadas` : "Sin costos"}
        />
        <Cell
          label="A catálogo NICE"
          value={formatMoney(valuation.catalogCents)}
          hint={`${formatNumber(valuation.pieces)} piezas de lista`}
        />
        <Cell
          label="A tu precio"
          value={formatMoney(valuation.retailCents)}
          hint={priceHint}
        />
        <Cell
          label="Ganancia proyectada"
          value={hasCost ? formatMoney(valuation.projectedProfitCents) : "—"}
          hint={margin !== null ? `${margin}% de margen` : "Falta capturar costos"}
          accent
        />
      </div>

      {missing > 0 && (
        <div className="border-t border-line bg-canvas px-4 py-3.5">
          <p className="text-[12px] leading-relaxed text-mute">
            {missing === 1
              ? "Falta el costo de 1 pieza, así que no entra en los cálculos."
              : `Faltan los costos de ${formatNumber(missing)} piezas, así que no entran en los cálculos.`}{" "}
            {discountPct > 0 ? (
              <>Se llenan solos en tus próximas recepciones con tu {discountPct}% de descuento.</>
            ) : (
              <>
                Escribe tu descuento de distribuidora en{" "}
                <Link
                  href="/dashboard/settings"
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  Configuración
                </Link>{" "}
                y los calculamos por ti.
              </>
            )}
          </p>

          {/* El puente para quien cargó su inventario antes de escribir su
              descuento: sin esto tendría que abrir pieza por pieza. */}
          {discountPct > 0 && (
            <button
              onClick={fillCosts}
              disabled={pending}
              className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-medium transition-colors hover:border-ink/25 disabled:opacity-40"
            >
              <Calculator size={14} strokeWidth={1.9} />
              {pending
                ? "Calculando…"
                : `Calcular los que faltan con mi ${discountPct}%`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Cell({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="border-b border-line p-4 last:border-b-0 sm:border-b-0">
      <p className="text-[11px] uppercase tracking-[0.1em] text-mute">{label}</p>
      <p className={`mt-1.5 text-[19px] font-medium tabular-nums ${accent ? "text-gold" : ""}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-mute">{hint}</p>
    </div>
  );
}
