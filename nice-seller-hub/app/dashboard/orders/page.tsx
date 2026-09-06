import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { listOrders } from "@/lib/seller";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { OrdersList } from "@/components/dashboard/OrdersList";
import { EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { seller } = await requireSeller();
  const orders = await listOrders(seller.id);

  return (
    <PageShell>
      <PageHeader
        title="Pedidos"
        subtitle="Lo que te han pedido desde tu tienda. Todavía no descuentan inventario."
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={30} strokeWidth={1.3} />}
          title="Todavía no tienes pedidos"
          description="Cuando alguien arme su pedido desde tu enlace, aparecerá aquí con su folio."
          action={
            <LinkButton href={`/${seller.slug}`} variant="secondary">
              Ver mi tienda
            </LinkButton>
          }
        />
      ) : (
        <OrdersList orders={orders} />
      )}
    </PageShell>
  );
}
