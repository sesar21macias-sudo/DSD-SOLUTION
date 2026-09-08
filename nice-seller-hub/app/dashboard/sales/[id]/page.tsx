import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Clock, Check, Ban } from "lucide-react";
import { requireSeller } from "@/lib/session";
import { getSale } from "@/lib/seller";
import { PAYMENT_LABEL } from "@/lib/payments";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { profitCents } from "@/lib/costing";
import { PageShell } from "@/components/dashboard/PageHeader";
import { CancelSaleButton, PaymentPanel } from "@/components/dashboard/PaymentPanel";
import { Badge, Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Venta" };
export const dynamic = "force-dynamic";

/**
 * El detalle de una venta.
 *
 * Existe sobre todo por los apartados: es donde se cobra un abono, se ve el
 * saldo y se revisa que cada peso que entro este escrito. Una venta de contado
 * tambien vive aqui, solo que sin nada pendiente que hacer.
 */
export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;

  // `getSale` acota por sellerId: un id de otra tienda simplemente no existe.
  const sale = await getSale(seller.id, Number(id));
  if (!sale) notFound();

  const cancelled = sale.status === "cancelled";
  const open = sale.status === "partial";

  // Un apartado que ya pasó de la fecha acordada. Se dice, no se castiga: el
  // sistema no cancela nada solo — esa conversación es de ella con su clienta.
  const overdue =
    open && sale.dueDate !== null && sale.dueDate < new Date().toISOString().slice(0, 10);

  // La ganancia solo se muestra cuando todas las piezas traen costo: mezclar
  // renglones costeados con otros sin costear daria un numero que se lee como
  // ganancia real y no lo es.
  const allCosted = sale.items.every((i) => i.unitCostCents !== null);
  const costTotal = sale.items.reduce(
    (sum, i) => sum + (i.unitCostCents ?? 0) * i.quantity,
    0
  );
  const profit = allCosted ? profitCents(sale.totalCents, costTotal) : null;

  return (
    <PageShell>
      <Link
        href="/dashboard/sales"
        className="-ml-2 mb-4 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[14px] text-mute transition-colors hover:bg-line/60 hover:text-ink"
      >
        <ChevronLeft size={16} strokeWidth={1.8} />
        Ventas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-light leading-tight">
            {formatMoney(sale.totalCents)}
          </h1>
          <p className="mt-1 text-[13px] text-mute">
            {formatDateTime(sale.createdAt)} · {PAYMENT_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
          </p>
        </div>

        {cancelled ? (
          <Badge className="bg-neutral-100 text-neutral-600">
            <Ban size={11} strokeWidth={2} />
            Cancelada
          </Badge>
        ) : open ? (
          <Badge className="bg-amber-100 text-amber-800">
            <Clock size={11} strokeWidth={2} />
            Debe {formatMoney(sale.balanceCents)}
          </Badge>
        ) : (
          <Badge className="bg-emerald-100 text-emerald-800">
            <Check size={11} strokeWidth={2.2} />
            Pagada
          </Badge>
        )}
      </div>

      {sale.customerName && (
        <Link
          href={`/dashboard/customers/${sale.customerId}`}
          className="mt-4 inline-block text-[14px] font-medium underline-offset-4 hover:underline"
        >
          {sale.customerName}
        </Link>
      )}

      {open && sale.dueDate && (
        <p
          className={`mt-2 text-[13px] ${overdue ? "font-medium text-amber-800" : "text-mute"}`}
        >
          {overdue ? "Se pasó de la fecha: acordaron terminar el " : "Acordaron terminar el "}
          {formatDate(`${sale.dueDate}T12:00:00.000Z`)}.
          {overdue ? " Recuérdale por WhatsApp abajo." : ""}
        </p>
      )}

      {/* Piezas */}
      <section className="mt-6">
        <SectionTitle>Piezas</SectionTitle>
        <Card className="divide-y divide-line">
          {sale.items.map((i) => (
            <div key={i.id} className="flex items-baseline gap-3 px-4 py-3.5">
              <span className="w-7 shrink-0 text-[14px] font-medium tabular-nums text-mute">
                {i.quantity}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{i.nameSnapshot}</p>
                <p className="text-[11px] tabular-nums text-mute">
                  NICE {i.codeSnapshot}
                  {i.unitCostCents !== null
                    ? ` · te costó ${formatMoney(i.unitCostCents)}`
                    : ""}
                </p>
              </div>
              <span className="shrink-0 text-[14px] font-medium tabular-nums">
                {formatMoney(i.subtotalCents)}
              </span>
            </div>
          ))}

          <div className="space-y-1.5 bg-canvas px-4 py-4">
            {sale.discountCents > 0 && (
              <>
                <Row label="Subtotal" value={formatMoney(sale.totalCents + sale.discountCents)} />
                <Row
                  label={`Cupón ${sale.redemptionCode ?? ""}`}
                  value={`−${formatMoney(sale.discountCents)}`}
                  gold
                />
              </>
            )}
            <Row label="Total" value={formatMoney(sale.totalCents)} strong />
            {profit !== null && (
              <Row label="Tu ganancia" value={formatMoney(profit)} gold />
            )}
            {!allCosted && (
              <p className="pt-1 text-[11px] leading-relaxed text-mute">
                No calculamos la ganancia porque falta el costo de alguna pieza.
              </p>
            )}
          </div>
        </Card>
      </section>

      {/* Abonos */}
      <section className="mt-8">
        <SectionTitle>
          {open ? "Abonos" : sale.payments.length > 1 ? "Abonos" : "Pago"}
        </SectionTitle>

        {sale.payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[13px] leading-relaxed text-mute">
            {/* Las ventas anteriores a los abonos no tienen detalle de pagos.
                Decirlo es mejor que dejar un vacío que se lee como un error. */}
            Esta venta se registró antes de que existiera el detalle de abonos,
            <br />
            así que solo quedó guardado su total.
          </p>
        ) : (
          <Card className="divide-y divide-line">
            {sale.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{formatDateTime(p.createdAt)}</p>
                  <p className="truncate text-[11px] text-mute">
                    {PAYMENT_LABEL[p.method] ?? p.method}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-medium tabular-nums text-emerald-600">
                  +{formatMoney(p.amountCents)}
                </span>
              </div>
            ))}

            <div className="flex items-baseline justify-between bg-canvas px-4 py-3.5">
              <span className="text-[13px] text-mute">Abonado</span>
              <span className="text-[14px] font-medium tabular-nums">
                {formatMoney(sale.paidCents)}
                {open && (
                  <span className="ml-2 text-[12px] font-normal text-amber-700">
                    faltan {formatMoney(sale.balanceCents)}
                  </span>
                )}
              </span>
            </div>
          </Card>
        )}
      </section>

      {open && (
        <section className="mt-6">
          <PaymentPanel
            saleId={sale.id}
            balanceCents={sale.balanceCents}
            customerName={sale.customerName}
            customerPhone={sale.customerPhone}
            businessName={seller.businessName}
            messageTemplate={seller.paymentReminderTemplate}
          />
        </section>
      )}

      {sale.note && (
        <p className="mt-6 rounded-2xl bg-line/40 px-4 py-3.5 text-[13px] leading-relaxed text-ink-soft">
          {sale.note}
        </p>
      )}

      {!cancelled && (
        <div className="mt-8 border-t border-line pt-5">
          <CancelSaleButton saleId={sale.id} hasPayments={sale.paidCents > 0} />
        </div>
      )}
    </PageShell>
  );
}

function Row({
  label,
  value,
  strong,
  gold,
}: {
  label: string;
  value: string;
  strong?: boolean;
  gold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-[13px] ${gold ? "text-gold" : "text-mute"}`}>{label}</span>
      <span
        className={`tabular-nums ${
          strong ? "text-[17px] font-medium" : gold ? "text-[13px] text-gold" : "text-[13px]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
