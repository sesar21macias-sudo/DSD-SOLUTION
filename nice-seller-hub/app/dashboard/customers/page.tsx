import Link from "next/link";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { listCustomers } from "@/lib/seller";
import { tierFor } from "@/lib/loyalty";
import { formatDate, formatMoney } from "@/lib/format";
import { maskPhone } from "@/lib/phone";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { CustomerSearch } from "@/components/dashboard/CustomerSearch";
import { Badge, Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

/**
 * La cartera de esta distribuidora. El telefono se muestra enmascarado en la
 * lista: alcanza para reconocer a alguien, y el numero completo solo aparece
 * al abrir su ficha, donde se necesita para escribirle.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { seller } = await requireSeller();
  const { q } = await searchParams;

  const customers = await listCustomers(seller.id, q);

  return (
    <PageShell>
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} ${customers.length === 1 ? "persona" : "personas"} en tu cartera`}
      />

      <CustomerSearch initialQuery={q ?? ""} />

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users size={30} strokeWidth={1.3} />}
          title={q ? "Nadie coincide con esa búsqueda" : "Todavía no tienes clientes registrados"}
          description={
            q
              ? "Prueba con otro nombre o con parte del teléfono."
              : "Cuando registres una venta con nombre y teléfono, la persona queda aquí con sus puntos."
          }
        />
      ) : (
        <Card className="divide-y divide-line">
          {customers.map((c) => {
            const tier = tierFor(c.points);
            return (
              <Link
                key={c.id}
                href={`/dashboard/customers/${c.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-soft text-[14px] font-medium text-gold">
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{c.name}</p>
                  <p className="text-[11px] tabular-nums text-mute">
                    {maskPhone(c.phone)} · {c.purchases}{" "}
                    {c.purchases === 1 ? "compra" : "compras"}
                    {c.lastPurchase ? ` · ${formatDate(c.lastPurchase)}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-medium tabular-nums">
                    {formatMoney(c.spentCents)}
                  </p>
                  <Badge className={`${tier.className} mt-1`}>{tier.name}</Badge>
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </PageShell>
  );
}
