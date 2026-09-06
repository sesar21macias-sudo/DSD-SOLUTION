import { Plus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { listSales, getDashboardStats, rangeStart } from "@/lib/seller";
import { PAYMENT_LABEL } from "@/lib/payments";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { Card, EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const { seller } = await requireSeller();

  const [sales, stats] = await Promise.all([
    listSales(seller.id),
    getDashboardStats(seller.id, rangeStart("30d")),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Ventas"
        subtitle={`${formatMoney(stats.revenueCents)} en los últimos 30 días`}
        action={
          <LinkButton href="/dashboard/sales/new" size="sm">
            <Plus size={15} strokeWidth={2} />
            Nueva venta
          </LinkButton>
        }
      />

      {sales.length === 0 ? (
        <EmptyState
          icon={<Wallet size={30} strokeWidth={1.3} />}
          title="Todavía no has registrado ventas"
          description="Cada venta que registres descuenta tu inventario y suma puntos a tu clienta."
          action={
            <LinkButton href="/dashboard/sales/new">
              <Plus size={16} strokeWidth={2} />
              Registrar una venta
            </LinkButton>
          }
        />
      ) : (
        <Card className="divide-y divide-line">
          {sales.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
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
              <span className="shrink-0 text-[15px] font-medium tabular-nums">
                {formatMoney(s.totalCents)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
