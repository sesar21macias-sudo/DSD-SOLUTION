import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { getOrderDetail, listInventory } from "@/lib/seller";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { EditOrderForm } from "@/components/dashboard/EditOrderForm";

export const metadata: Metadata = { title: "Editar pedido" };
export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;

  const order = await getOrderDetail(seller.id, Number(id));
  if (!order) notFound();

  const items = await listInventory(seller.id);

  return (
    <PageShell>
      <PageHeader
        title={`Pedido ${order.orderNumber}`}
        subtitle="Corrige piezas, cantidades o el cliente antes de registrar la venta."
      />
      <EditOrderForm order={order} items={items} />
    </PageShell>
  );
}
