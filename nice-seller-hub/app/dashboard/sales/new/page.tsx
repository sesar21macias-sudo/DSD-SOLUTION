import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import { listInventory } from "@/lib/seller";
import { findAvailableRedemption } from "@/lib/loyalty";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { SaleForm } from "@/components/dashboard/SaleForm";
import { EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Nueva venta" };
export const dynamic = "force-dynamic";

/**
 * Registrar una venta. Si viene con `?order=`, el formulario llega prellenado
 * con las piezas de ese pedido: es el paso natural despues de confirmarlo por
 * WhatsApp, y evita recapturar lo que ya se sabe.
 */
export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { seller } = await requireSeller();
  const { order: orderParam } = await searchParams;

  const items = (await listInventory(seller.id)).filter((i) => i.stock > 0);

  let prefill: { inventoryId: number; quantity: number }[] = [];
  let orderId: number | null = null;
  let contact: { name: string; phone: string } | null = null;
  let coupon: { code: string; name: string; kind: string; value: number } | null = null;

  const orderIdParam = Number(orderParam);
  if (Number.isFinite(orderIdParam) && orderIdParam > 0) {
    const db = await getDb();
    // El pedido se busca acotado a esta tienda: un id ajeno simplemente no
    // encuentra nada y el formulario abre vacio.
    const rows = await db
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.id, orderIdParam), eq(schema.orders.sellerId, seller.id)))
      .limit(1);

    const order = rows[0];
    if (order) {
      orderId = order.id;
      contact = {
        name: order.contactName ?? "",
        phone: order.contactPhone ?? "",
      };

      // Solo si el cupon sigue vigente: uno ya usado no vuelve a descontar.
      if (order.redemptionCode) {
        const redemption = await findAvailableRedemption(seller.id, order.redemptionCode);
        if (redemption) {
          coupon = {
            code: redemption.code,
            name: redemption.nameSnapshot,
            kind: redemption.kind,
            value: redemption.value,
          };
        }
      }

      const orderItems = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));

      // Las partidas del pedido se traducen a lineas de inventario por
      // productId; si una pieza ya se elimino del inventario, se omite.
      const byProduct = new Map(items.map((i) => [i.productId, i]));
      prefill = orderItems
        .map((oi) => {
          const inv = byProduct.get(oi.productId);
          return inv ? { inventoryId: inv.inventoryId, quantity: oi.quantity } : null;
        })
        .filter((l): l is { inventoryId: number; quantity: number } => l !== null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Nueva venta"
        subtitle="Al registrarla se descuenta tu inventario y se suman los puntos."
      />

      {items.length === 0 ? (
        <EmptyState
          title="No tienes piezas con existencias"
          description="Agrega piezas o sube el stock de las que ya tienes para poder registrar una venta."
          action={
            <LinkButton href="/dashboard/inventory">Ir a mi inventario</LinkButton>
          }
        />
      ) : (
        <SaleForm
          items={items}
          prefill={prefill}
          orderId={orderId}
          contact={contact}
          coupon={coupon}
        />
      )}
    </PageShell>
  );
}
