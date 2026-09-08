import Link from "next/link";
import { ChevronRight, Clock, Plus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { listSales, getDashboardStats, getProfitStats, getReceivables, rangeStart } from "@/lib/seller";
import { PAYMENT_LABEL } from "@/lib/payments";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

/**
 * Las ventas.
 *
 * Lo que se debe va arriba y separado: una venta a abonos no es historial, es
 * algo que todavia hay que cobrar, y mezclarla con las demas seria esconderla.
 */
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { seller } = await requireSeller();
  const { filtro } = await searchParams;

  const since = rangeStart("30d");
  const [sales, stats, profit, receivables] = await Promise.all([
    listSales(seller.id),
    getDashboardStats(seller.id, since),
    getProfitStats(seller.id, since),
    getReceivables(seller.id),
  ]);

  const onlyOpen = filtro === "por-cobrar";
  const shown = onlyOpen ? sales.filter((s) => s.status === "partial") : sales;

  return (
    <PageShell>
      <PageHeader
        title="Ventas"
        subtitle={`${formatMoney(stats.revenueCents)} en los últimos 30 días${
          profit.profitCents > 0 ? ` · ${formatMoney(profit.profitCents)} de ganancia` : ""
        }`}
        action={
          <div className="flex gap-2">
            <ExportButton tipo="ventas" label="Excel" />
            <LinkButton href="/dashboard/sales/new" size="sm">
              <Plus size={15} strokeWidth={2} />
              Nueva venta
            </LinkButton>
          </div>
        }
      />

      {receivables.count > 0 && (
        <Link
          href={onlyOpen ? "/dashboard/sales" : "/dashboard/sales?filtro=por-cobrar"}
          className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 transition-transform hover:-translate-y-px"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700 shadow-sm">
            <Clock size={17} strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-amber-900">
              Te deben {formatMoney(receivables.totalCents)}
            </span>
            <span className="block text-[12px] text-amber-800/80">
              {receivables.count} {receivables.count === 1 ? "venta" : "ventas"} a abonos
              {receivables.overdue > 0
                ? ` · ${receivables.overdue} pasada${receivables.overdue === 1 ? "" : "s"} de fecha`
                : ""}
              {onlyOpen ? " · toca para ver todas" : ""}
            </span>
          </span>
          <ChevronRight size={16} strokeWidth={1.9} className="shrink-0 text-amber-700/50" />
        </Link>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={<Wallet size={30} strokeWidth={1.3} />}
          title={onlyOpen ? "No tienes nada por cobrar" : "Todavía no has registrado ventas"}
          description={
            onlyOpen
              ? "Todas tus ventas a abonos están saldadas."
              : "Cada venta que registres descuenta tu inventario y suma puntos a tu clienta."
          }
          action={
            onlyOpen ? (
              <LinkButton href="/dashboard/sales" variant="secondary">
                Ver todas las ventas
              </LinkButton>
            ) : (
              <LinkButton href="/dashboard/sales/new">
                <Plus size={16} strokeWidth={2} />
                Registrar una venta
              </LinkButton>
            )
          }
        />
      ) : (
        <Card className="divide-y divide-line">
          {shown.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/sales/${s.id}`}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {s.customerName ?? "Venta de mostrador"}
                </p>
                <p className="text-[11px] text-mute">
                  {formatDateTime(s.createdAt)} · {s.itemCount}{" "}
                  {s.itemCount === 1 ? "pieza" : "piezas"} ·{" "}
                  {PAYMENT_LABEL[s.paymentMethod] ?? s.paymentMethod}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={`text-[15px] font-medium tabular-nums ${
                    s.status === "cancelled" ? "text-mute line-through" : ""
                  }`}
                >
                  {formatMoney(s.totalCents)}
                </p>
                {s.status === "partial" && (
                  <Badge className="mt-1 bg-amber-100 text-amber-800">
                    debe {formatMoney(s.balanceCents)}
                  </Badge>
                )}
                {s.status === "cancelled" && (
                  <Badge className="mt-1 bg-neutral-100 text-neutral-600">cancelada</Badge>
                )}
              </div>

              <ChevronRight size={16} strokeWidth={1.8} className="shrink-0 text-mute-soft" />
            </Link>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
