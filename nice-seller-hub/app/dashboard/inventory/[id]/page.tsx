import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { getInventoryItem } from "@/lib/seller";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { EditInventoryForm } from "@/components/dashboard/EditInventoryForm";

export const metadata: Metadata = { title: "Editar pieza" };
export const dynamic = "force-dynamic";

export default async function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { seller } = await requireSeller();
  const { id } = await params;

  // `getInventoryItem` ya acota por sellerId: un id de otra tienda devuelve
  // null y esta pagina responde "no existe", sin confirmar que existe.
  const item = await getInventoryItem(seller.id, Number(id));
  if (!item) notFound();

  return (
    <PageShell>
      <PageHeader title={item.name} subtitle={`Código NICE ${item.niceCode}`} />
      <EditInventoryForm item={item} />
    </PageShell>
  );
}
