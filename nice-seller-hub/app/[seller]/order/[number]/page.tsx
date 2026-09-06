import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getSellerBySlug } from "@/lib/store";
import { getOrderByNumber, ORDER_STATUS_LABELS } from "@/lib/orders";
import { buildOrderMessage, firstName, waLink } from "@/lib/whatsapp";
import { formatMoney, formatDateTime } from "@/lib/format";
import { OpenWhatsApp } from "@/components/store/OpenWhatsApp";

export const metadata: Metadata = { title: "Pedido generado" };
export const dynamic = "force-dynamic";

/**
 * La confirmacion. Existe por dos razones: darle a la persona un folio que
 * pueda volver a abrir, y ser la red de seguridad cuando el navegador bloquea
 * la ventana de WhatsApp — desde aqui el enlace se abre con un toque directo,
 * que ningun bloqueador detiene.
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ seller: string; number: string }>;
}) {
  const { seller: slug, number } = await params;

  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  const order = await getOrderByNumber(seller.id, number);
  if (!order) notFound();

  const message = buildOrderMessage({
    sellerFirstName: firstName(seller.businessName),
    orderNumber: order.orderNumber,
    items: order.items.map((i) => ({
      name: i.name,
      code: i.code,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    totalCents: order.totalCents,
    customerName: order.contactName,
    note: order.note,
  });

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="animate-scale-in mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <Check size={26} strokeWidth={2.2} />
      </div>

      <h1 className="animate-fade-up mt-5 text-center text-[26px] font-light">
        Tu pedido está listo
      </h1>
      <p className="animate-fade-up mt-2 text-center text-[14px] leading-relaxed text-mute">
        Mándalo por WhatsApp a {seller.businessName} para que te confirme disponibilidad y la forma
        de pago.
      </p>

      <div className="animate-fade-up mt-6 rounded-2xl border border-line bg-surface p-5 text-center shadow-card">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Folio</p>
        <p className="mt-1.5 text-[19px] font-medium tabular-nums">{order.orderNumber}</p>
        <p className="mt-2 text-[12px] text-mute">
          {formatDateTime(order.createdAt)} · {ORDER_STATUS_LABELS[order.status]}
        </p>
      </div>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {order.items.map((i) => (
          <li key={i.code} className="flex items-baseline gap-3 px-4 py-3.5">
            <span className="w-7 shrink-0 text-[14px] font-medium tabular-nums text-mute">
              {i.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{i.name}</p>
              <p className="text-[11px] tabular-nums text-mute">NICE {i.code}</p>
            </div>
            <span className="shrink-0 text-[14px] font-medium tabular-nums">
              {formatMoney(i.subtotalCents)}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between bg-canvas px-4 py-4">
          <span className="text-[15px] font-medium">Total</span>
          <span className="text-[20px] font-medium tabular-nums">
            {formatMoney(order.totalCents)}
            <span className="ml-1 text-[12px] font-normal text-mute">MXN</span>
          </span>
        </li>
      </ul>

      <OpenWhatsApp
        href={waLink(seller.whatsapp, message)}
        orderNumber={order.orderNumber}
        slug={slug}
      />

      <Link
        href={`/${slug}`}
        className="mt-3 block text-center text-[14px] text-mute transition-colors hover:text-ink"
      >
        Seguir viendo la tienda
      </Link>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-mute">
        Guarda este folio: con él puedes volver a abrir tu pedido desde este mismo enlace.
      </p>
    </main>
  );
}
