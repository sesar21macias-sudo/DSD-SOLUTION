import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  PackageX,
  Plus,
  Sparkles,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { requireSeller } from "@/lib/session";
import {
  getCategoryBreakdown,
  getDailyRevenue,
  getDashboardStats,
  getProfitStats,
  getReceivables,
  getTopProducts,
  listOrders,
  rangeStart,
} from "@/lib/seller";
import { getProgram, listRedemptions } from "@/lib/loyalty";
import { formatMoney, formatNumber, greeting } from "@/lib/format";
import { firstName } from "@/lib/whatsapp";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, type OrderStatus } from "@/lib/orders";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { RankBars, RevenueChart, StatCard } from "@/components/dashboard/Charts";
import { Card, LinkButton, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * La primera pantalla. Responde tres preguntas en el orden en que importan:
 * como voy, que necesita mi atencion ahora, y que se esta vendiendo.
 */
export default async function DashboardHome() {
  const { user, seller } = await requireSeller();
  const since = rangeStart("30d");

  const [stats, revenue, top, categories, orders, program, profit, receivables] =
    await Promise.all([
      getDashboardStats(seller.id, since),
      getDailyRevenue(seller.id, since),
      getTopProducts(seller.id, since),
      getCategoryBreakdown(seller.id, since),
      listOrders(seller.id),
      getProgram(seller.id),
      getProfitStats(seller.id, since),
      getReceivables(seller.id),
    ]);

  // Un cupon sin usar es alguien esperando un descuento: va con los avisos, no
  // escondido en la pantalla del club.
  const openCoupons = program.enabled
    ? await listRedemptions(seller.id, "available")
    : [];

  const pendingOrders = orders.filter((o) =>
    ["pending", "whatsapp_sent", "confirmed", "preparing"].includes(o.status)
  );

  return (
    <PageShell>
      <PageHeader
        title={`${greeting()}, ${firstName(user.name)} 👋`}
        subtitle="Así van tus últimos 30 días."
        action={
          <LinkButton href="/dashboard/sales/new" size="sm">
            <Plus size={15} strokeWidth={2} />
            Venta
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ventas" value={formatMoney(stats.revenueCents)} hint="Últimos 30 días" accent />
        {/*
          La ganancia ocupa el segundo lugar cuando ya se puede calcular: es el
          numero que contesta "como me fue" mejor que las piezas vendidas.
        */}
        {profit.unitsWithCost > 0 ? (
          <StatCard
            label="Ganancia"
            value={formatMoney(profit.profitCents)}
            hint="Últimos 30 días"
          />
        ) : (
          <StatCard label="Piezas vendidas" value={formatNumber(stats.unitsSold)} hint="Últimos 30 días" />
        )}
        <StatCard label="Clientes" value={formatNumber(stats.customers)} hint="En tu cartera" />
        <StatCard
          label="Inventario"
          value={formatNumber(stats.inventoryCount)}
          hint={stats.soldOut > 0 ? `${stats.soldOut} agotados` : "Piezas disponibles"}
        />
      </div>

      {(stats.lowStock.length > 0 ||
        stats.soldOut > 0 ||
        pendingOrders.length > 0 ||
        openCoupons.length > 0 ||
        receivables.count > 0) && (
        <section className="mt-6 space-y-2.5">
          {receivables.count > 0 && (
            <Alert
              href="/dashboard/sales?filtro=por-cobrar"
              icon={<Clock size={16} strokeWidth={1.9} />}
              tone="amber"
              title={`Te deben ${formatMoney(receivables.totalCents)}`}
              body={
                receivables.overdue > 0
                  ? `${receivables.count} ${receivables.count === 1 ? "venta" : "ventas"} a abonos · ${receivables.overdue} pasada${receivables.overdue === 1 ? "" : "s"} de fecha`
                  : `${receivables.count} ${receivables.count === 1 ? "venta" : "ventas"} a abonos por cobrar`
              }
            />
          )}
          {openCoupons.length > 0 && (
            <Alert
              href="/dashboard/loyalty"
              icon={<Ticket size={16} strokeWidth={1.9} />}
              tone="gold"
              title={
                openCoupons.length === 1
                  ? "1 cupón del club sin usar"
                  : `${openCoupons.length} cupones del club sin usar`
              }
              body="Cuando te enseñen el código, márcalo como usado."
            />
          )}
          {pendingOrders.length > 0 && (
            <Alert
              href="/dashboard/orders"
              icon={<TrendingUp size={16} strokeWidth={1.9} />}
              tone="ink"
              title={
                pendingOrders.length === 1
                  ? "Tienes 1 pedido esperando"
                  : `Tienes ${pendingOrders.length} pedidos esperando`
              }
              body="Confírmalos por WhatsApp y regístralos como venta."
            />
          )}
          {stats.lowStock.map((p) => (
            <Alert
              key={p.niceCode}
              href="/dashboard/inventory"
              icon={<AlertTriangle size={16} strokeWidth={1.9} />}
              tone="amber"
              title={`${p.name} ${p.niceCode}`}
              body={p.stock === 1 ? "Queda 1 pieza." : `Quedan ${p.stock} piezas.`}
            />
          ))}
          {stats.soldOut > 0 && (
            <Alert
              href="/dashboard/inventory"
              icon={<PackageX size={16} strokeWidth={1.9} />}
              tone="neutral"
              title={
                stats.soldOut === 1
                  ? "1 pieza está agotada"
                  : `${stats.soldOut} piezas están agotadas`
              }
              body="No aparecen en tu tienda mientras estén en cero."
            />
          )}
        </section>
      )}

      <section className="mt-8">
        <SectionTitle
          action={
            <Link
              href="/dashboard/analytics"
              className="flex items-center gap-1 text-[13px] text-mute transition-colors hover:text-ink"
            >
              Ver más
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          }
        >
          Ventas por día
        </SectionTitle>
        <Card className="p-5">
          <RevenueChart data={revenue} />
        </Card>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Lo que más se vende</SectionTitle>
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
          <SectionTitle>Por categoría</SectionTitle>
          <Card className="p-5">
            <RankBars
              rows={categories.map((c) => ({
                label: c.name,
                value: c.cents,
                display: formatMoney(c.cents),
              }))}
            />
          </Card>
        </section>
      </div>

      {!program.enabled && (
        <section className="mt-8">
          <Link
            href="/dashboard/loyalty"
            className="card-foil group flex items-center gap-4 overflow-hidden rounded-[22px] p-6 text-white shadow-lift transition-transform duration-300 hover:-translate-y-0.5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-gold">
              <Sparkles size={19} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Activa tu club de puntos</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-white/60">
                Tus clientas acumulan puntos con cada compra y los cambian por lo que tú decidas.
              </span>
            </span>
            <ArrowRight
              size={17}
              strokeWidth={1.8}
              className="shrink-0 text-white/40 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white"
            />
          </Link>
        </section>
      )}

      {orders.length > 0 && (
        <section className="mt-8">
          <SectionTitle
            action={
              <Link
                href="/dashboard/orders"
                className="flex items-center gap-1 text-[13px] text-mute transition-colors hover:text-ink"
              >
                Todos
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
            }
          >
            Últimos pedidos
          </SectionTitle>
          <Card className="divide-y divide-line">
            {orders.slice(0, 5).map((o) => (
              <Link
                key={o.id}
                href="/dashboard/orders"
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {o.contactName ?? "Cliente sin nombre"}
                  </p>
                  <p className="text-[11px] tabular-nums text-mute">{o.orderNumber}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    ORDER_STATUS_STYLES[o.status as OrderStatus]
                  }`}
                >
                  {ORDER_STATUS_LABELS[o.status as OrderStatus]}
                </span>
                <span className="shrink-0 text-[14px] font-medium tabular-nums">
                  {formatMoney(o.totalCents)}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </PageShell>
  );
}

const TONES = {
  ink: "border-ink/12 bg-ink/[0.03] text-ink",
  amber: "border-amber-200 bg-amber-50/70 text-amber-900",
  gold: "border-gold/30 bg-gold-soft/60 text-ink",
  neutral: "border-line bg-surface text-ink-soft",
};

function Alert({
  href,
  icon,
  title,
  body,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: keyof typeof TONES;
}) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-transform hover:-translate-y-px ${TONES[tone]}`}
    >
      <span className="mt-0.5 shrink-0 opacity-70">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{title}</span>
        <span className="block text-[12px] opacity-70">{body}</span>
      </span>
      <ArrowRight size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 opacity-40" />
    </Link>
  );
}
