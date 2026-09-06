import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { getCustomer, listCustomerSales } from "@/lib/seller";
import { pointsToNextTier, tierFor } from "@/lib/loyalty";
import { PAYMENT_LABEL } from "@/lib/payments";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { PageShell } from "@/components/dashboard/PageHeader";
import { Badge, Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;

  // `getCustomer` solo devuelve gente de la cartera de esta tienda.
  const customer = await getCustomer(seller.id, Number(id));
  if (!customer) notFound();

  const sales = await listCustomerSales(seller.id, customer.id);
  const tier = tierFor(customer.points);
  const next = pointsToNextTier(customer.points);

  return (
    <PageShell>
      <div className="flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold-soft text-[22px] font-light text-gold">
          {customer.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-light leading-tight">{customer.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-[14px]">
            <span className="tabular-nums text-gold">⭐ {formatNumber(customer.points)} puntos</span>
            <Badge className={tier.className}>{tier.name}</Badge>
          </p>
        </div>
      </div>

      <a
        href={`https://wa.me/${customer.phone}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-[14px] font-medium text-white transition-transform active:scale-[0.98]"
      >
        <MessageCircle size={16} strokeWidth={2} />
        {displayPhone(customer.phone)}
      </a>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Compras" value={formatNumber(customer.purchases)} />
        <Stat label="Total gastado" value={formatMoney(customer.spentCents)} />
        <Stat
          label="Última compra"
          value={customer.lastPurchase ? formatDate(customer.lastPurchase) : "—"}
          small
        />
      </div>

      {next && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[13px]">
            Le faltan{" "}
            <span className="font-medium tabular-nums">{formatNumber(next.missing)} puntos</span>{" "}
            para llegar a <span className="font-medium">{next.tier.name}</span>.
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-700"
              style={{
                width: `${Math.min(100, (customer.points / next.tier.min) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <section className="mt-8">
        <SectionTitle>Historial de compras</SectionTitle>
        {sales.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong py-8 text-center text-[13px] text-mute">
            Todavía no le has registrado ninguna venta.
          </p>
        ) : (
          <Card className="divide-y divide-line">
            {sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-medium">{formatDateTime(s.createdAt)}</p>
                  <p className="text-[11px] text-mute">
                    {PAYMENT_LABEL[s.paymentMethod] ?? s.paymentMethod}
                  </p>
                </div>
                <span className="text-[14px] font-medium tabular-nums">
                  {formatMoney(s.totalCents)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[11px] text-mute">{label}</p>
      <p className={`mt-1 font-medium tabular-nums ${small ? "text-[14px]" : "text-[19px]"}`}>
        {value}
      </p>
    </div>
  );
}
