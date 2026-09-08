import Link from "next/link";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import {
  RANGES,
  getCategoryBreakdown,
  getDailyRevenue,
  getDashboardStats,
  getInventoryValuation,
  getProfitStats,
  getTopProducts,
  listOrders,
  rangeStart,
} from "@/lib/seller";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { RankBars, RevenueChart, StatCard } from "@/components/dashboard/Charts";
import { InventoryValue } from "@/components/dashboard/InventoryValue";
import { ProfitCompare } from "@/components/dashboard/ProfitCompare";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { seller } = await requireSeller();
  const { range: rangeParam } = await searchParams;

  const range = RANGES.find((r) => r.id === rangeParam)?.id ?? "30d";
  const since = rangeStart(range);

  const [stats, revenue, top, categories, orders, profit, valuation] = await Promise.all([
    getDashboardStats(seller.id, since),
    getDailyRevenue(seller.id, since),
    getTopProducts(seller.id, since, 8),
    getCategoryBreakdown(seller.id, since),
    listOrders(seller.id),
    getProfitStats(seller.id, since),
    getInventoryValuation(seller.id),
  ]);

  const ordersInRange = orders.filter((o) => o.createdAt >= since);
  const { label, sentence } = RANGES.find((r) => r.id === range)!;

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        subtitle={`Tu negocio ${sentence}`}
        action={<ExportButton tipo="ventas" rango={range} label="Descargar Excel" />}
      />

      <div className="no-scrollbar -mx-5 mb-6 flex gap-2 overflow-x-auto px-5">
        {RANGES.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/analytics?range=${r.id}`}
            scroll={false}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              range === r.id
                ? "bg-ink text-white"
                : "border border-line-strong bg-surface text-ink-soft hover:border-ink/25"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ingresos" value={formatMoney(stats.revenueCents)} accent />
        <StatCard label="Piezas vendidas" value={formatNumber(stats.unitsSold)} />
        <StatCard label="Pedidos" value={formatNumber(ordersInRange.length)} />
        <StatCard label="Clientes" value={formatNumber(stats.customers)} hint="Cartera total" />
      </div>

      {/*
        La ganancia va inmediatamente debajo de los ingresos porque es el
        numero que de verdad contesta "como me fue": vender mucho y ganar poco
        se ve igual en una grafica de ingresos.

        Real y proyectada se enseñan juntas porque son la misma pregunta vista
        desde dos lados: una es lo que ya cobraste, la otra es lo que tienes
        guardado sin cobrar todavia. Compararlas es lo que dice si el negocio
        vive de vender lo que ya tiene o de seguir recibiendo mercancia nueva.
      */}
      <section className="mt-6">
        <SectionTitle>Ganancia: real vs. proyectada</SectionTitle>

        {profit.unitsWithCost === 0 && valuation.piecesWithCost === 0 ? (
          <Card className="p-5">
            <p className="text-[13px] leading-relaxed text-mute">
              Todavía no podemos calcularla: ninguna pieza tiene su costo capturado. Escribe tu
              descuento de distribuidora en{" "}
              <Link href="/dashboard/settings" className="font-medium text-ink underline-offset-4 hover:underline">
                Configuración
              </Link>{" "}
              y el costo se llenará solo en tus próximas recepciones.
            </p>
          </Card>
        ) : (
          <>
            <ProfitCompare
              realCents={profit.profitCents}
              projectedCents={valuation.projectedProfitCents}
              rangeLabel={sentence}
              hasRealData={profit.unitsWithCost > 0}
              hasProjectedData={valuation.piecesWithCost > 0}
            />

            {profit.unitsWithCost > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard label="Vendido (piezas costeadas)" value={formatMoney(profit.revenueCents)} />
                <StatCard label="Te costó" value={formatMoney(profit.costCents)} />
                <StatCard label="Ganancia real" value={formatMoney(profit.profitCents)} accent />
              </div>
            )}

            {profit.unitsWithoutCost > 0 && (
              <p className="mt-2.5 text-[12px] leading-relaxed text-mute">
                Quedan fuera {formatNumber(profit.unitsWithoutCost)}{" "}
                {profit.unitsWithoutCost === 1 ? "pieza vendida" : "piezas vendidas"} sin costo
                capturado. La ganancia real es mayor que la de arriba.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>Ingresos por día</SectionTitle>
        <Card className="p-5">
          <RevenueChart data={revenue} height={180} />
        </Card>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Productos más vendidos</SectionTitle>
          <Card className="p-5">
            <RankBars
              rows={top.map((t) => ({
                label: t.name,
                sub: t.niceCode,
                value: t.quantity,
                display: `${t.quantity} · ${formatMoney(t.cents)}`,
              }))}
            />
          </Card>
        </section>

        <section>
          <SectionTitle>Distribución por categoría</SectionTitle>
          <Card className="p-5">
            <RankBars
              rows={categories.map((c) => ({
                label: c.name,
                sub: `${c.quantity} pzs`,
                value: c.cents,
                display: formatMoney(c.cents),
              }))}
            />
          </Card>
        </section>
      </div>

      <section className="mt-8">
        <SectionTitle>Inventario</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Piezas en existencia" value={formatNumber(stats.inventoryCount)} />
          <StatCard label="Agotadas" value={formatNumber(stats.soldOut)} />
          <StatCard label="Últimas piezas" value={formatNumber(stats.lowStock.length)} />
        </div>

        {valuation.lines > 0 && (
          <InventoryValue
            valuation={valuation}
            discountPct={seller.distributorDiscountPct}
            className="mt-3"
          />
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>Descargar para Excel</SectionTitle>
        <Card className="flex flex-wrap gap-2 p-5">
          <ExportButton tipo="ventas" rango={range} label="Ventas" />
          <ExportButton tipo="abonos" label="Abonos y saldos" />
          <ExportButton tipo="inventario" label="Inventario" />
          <ExportButton tipo="clientes" label="Clientes" />
          <ExportButton tipo="pedidos" label="Pedidos" />
        </Card>
        <p className="mt-2 text-[12px] leading-relaxed text-mute">
          Se descargan como archivo .csv, listo para abrirse en Excel o Google Sheets. Traen
          nombres y teléfonos de tus clientas: guárdalos como guardarías tu libreta.
        </p>
      </section>
    </PageShell>
  );
}
