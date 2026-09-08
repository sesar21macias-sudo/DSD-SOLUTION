import { notFound } from "next/navigation";
import { MessageCircle, Ticket } from "lucide-react";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { getCustomer, listCustomerSales } from "@/lib/seller";
import {
  getProgram,
  listCustomerRedemptions,
  listMovements,
  listRewards,
  pointsToNextTier,
  tierFor,
} from "@/lib/loyalty";
import { PAYMENT_LABEL } from "@/lib/payments";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { buildPointsMessage, firstName, waLink } from "@/lib/whatsapp";
import { PageShell } from "@/components/dashboard/PageHeader";
import { PointsAdjuster } from "@/components/dashboard/PointsAdjuster";
import { Badge, Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;

  // `getCustomer` solo devuelve gente de la cartera de esta tienda.
  const customer = await getCustomer(seller.id, Number(id));
  if (!customer) notFound();

  const [program, sales, redemptions, movements, rewards] = await Promise.all([
    getProgram(seller.id),
    listCustomerSales(seller.id, customer.id),
    listCustomerRedemptions(seller.id, customer.id),
    listMovements(seller.id, customer.id, 12),
    listRewards(seller.id, true),
  ]);

  const tier = tierFor(customer.lifetimePoints);
  const next = pointsToNextTier(customer.lifetimePoints);
  const activeCoupons = redemptions.filter((r) => r.status === "available");

  /**
   * El mensaje con su saldo y lo que ya puede canjear.
   *
   * Se arma aqui, con lo que de verdad hay en la base en este momento — igual
   * que el mensaje de un pedido, la lista de recompensas y si ya le alcanza
   * para cada una nunca sale de una plantilla libre.
   */
  const pointsMessage = buildPointsMessage({
    customerFirstName: firstName(customer.name),
    businessName: seller.businessName,
    points: customer.points,
    tierName: tier.name,
    rewards: rewards.map((r) => ({
      name: r.name,
      pointsCost: r.pointsCost,
      qualifies: r.pointsCost <= customer.points,
    })),
    greetingTemplate: seller.pointsGreetingTemplate,
    closingTemplate: seller.pointsClosingTemplate,
  });

  return (
    <PageShell>
      <div className="flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold-soft text-[22px] font-light text-gold">
          {customer.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-light leading-tight">{customer.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px]">
            <span className="tabular-nums text-gold">
              ⭐ {formatNumber(customer.points)} puntos disponibles
            </span>
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
                width: `${Math.min(100, (customer.lifetimePoints / next.tier.min) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Cupones vigentes: es lo unico de esta ficha que tiene a alguien
          esperando una respuesta. */}
      {activeCoupons.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Cupones sin usar</SectionTitle>
          <Card className="divide-y divide-line">
            {activeCoupons.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-white">
                  <Ticket size={16} strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium tabular-nums">{c.code}</p>
                  <p className="truncate text-[11px] text-mute">
                    {c.nameSnapshot} · {formatDate(c.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-[12px] text-mute">
            Se marcan como usados desde Club de puntos.
          </p>
        </section>
      )}

      {program.enabled && (
        <section className="mt-8">
          <SectionTitle
            action={
              <a
                href={waLink(customer.phone, pointsMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
              >
                <MessageCircle size={14} strokeWidth={1.9} className="text-[#25D366]" />
                Mandar sus puntos
              </a>
            }
          >
            Puntos
          </SectionTitle>
          <p className="-mt-3 mb-4 text-[12px] leading-relaxed text-mute">
            El mensaje le dice su saldo y cuáles de tus recompensas ya puede canjear —según lo que
            tengas activo en Club de puntos.
          </p>
          <PointsAdjuster customerId={customer.id} />

          {movements.length > 0 && (
            <Card className="mt-3 divide-y divide-line">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px]">{m.description ?? "Movimiento"}</p>
                    <p className="text-[11px] text-mute">{formatDate(m.createdAt)}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[13px] font-medium tabular-nums ${
                      m.points >= 0 ? "text-emerald-600" : "text-mute"
                    }`}
                  >
                    {m.points >= 0 ? "+" : ""}
                    {formatNumber(m.points)}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>
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
