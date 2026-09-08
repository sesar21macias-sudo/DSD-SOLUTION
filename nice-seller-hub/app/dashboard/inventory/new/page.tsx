import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { ProductForm } from "@/components/dashboard/ProductForm";

export const metadata: Metadata = { title: "Agregar pieza" };
export const dynamic = "force-dynamic";

export default async function NewInventoryPage() {
  const { seller } = await requireSeller();

  const db = await getDb();
  const categories = await db
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .orderBy(asc(schema.categories.position), asc(schema.categories.name));

  return (
    <PageShell>
      <PageHeader
        title="Agregar pieza"
        subtitle="Si el código NICE ya existe en el catálogo, reutilizamos sus datos."
      />
      <ProductForm categories={categories} discountPct={seller.distributorDiscountPct} />
    </PageShell>
  );
}
