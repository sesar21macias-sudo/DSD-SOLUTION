import { getPlatformStats, listActivity } from "@/lib/admin";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { StatCard } from "@/components/dashboard/Charts";
import { Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [stats, activity] = await Promise.all([getPlatformStats(), listActivity()]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-[28px] font-light">Resumen de la plataforma</h1>
      <p className="mt-1 text-[13px] text-mute">Todo lo que pasa en DSD Seller Hub.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Ventas totales" value={formatMoney(stats.salesCents)} accent />
        <StatCard
          label="Distribuidoras"
          value={formatNumber(stats.sellers)}
          hint={`${stats.activeSellers} activas`}
        />
        <StatCard label="Clientes" value={formatNumber(stats.customers)} />
        <StatCard label="Piezas en catálogo" value={formatNumber(stats.products)} />
        <StatCard label="Pedidos" value={formatNumber(stats.orders)} />
      </div>

      <section className="mt-10">
        <SectionTitle>Actividad reciente</SectionTitle>
        {activity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong py-10 text-center text-[13px] text-mute">
            Todavía no hay actividad.
          </p>
        ) : (
          <Card className="divide-y divide-line">
            {activity.map((a, i) => (
              <div key={`${a.at}-${i}`} className="flex items-baseline gap-3 px-4 py-3">
                <span className="flex-1 text-[13px]">{a.text}</span>
                <span className="shrink-0 text-[11px] text-mute">{formatDateTime(a.at)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </main>
  );
}
