import Link from "next/link";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import {
  RANGES,
  getCategoryBreakdown,
  getDailyRevenue,
  getDashboardStats,
  getTopProducts,
  listOrders,
  rangeStart,
} from "@/lib/seller";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { RankBars, RevenueChart, StatCard } from "@/components/dashboard/Charts";
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

  const [stats, revenue, top, categories, orders] = await Promise.all([
    getDashboardStats(seller.id, since),
    getDailyRevenue(seller.id, since),
    getTopProducts(seller.id, since, 8),
    getCategoryBreakdown(seller.id, since),
    listOrders(seller.id),
  ]);

  const ordersInRange = orders.filter((o) => o.createdAt >= since);
  const label = RANGES.find((r) => r.id === range)!.label;

  return (
    <PageShell>
      <PageHeader title="Analytics" subtitle={`Tu negocio en los últimos ${label.toLowerCase()}`} />

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
      </section>
    </PageShell>
  );
}
