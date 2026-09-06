import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import { getReception } from "@/lib/receptions";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { ReceptionReview } from "@/components/dashboard/ReceptionReview";

export const metadata: Metadata = { title: "Revisar recepción" };
export const dynamic = "force-dynamic";

/**
 * La revision del borrador. `getReception` ya acota por sellerId: un id de otra
 * distribuidora simplemente no existe desde aqui.
 */
export default async function ReviewReceptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { seller } = await requireSeller();
  const { id } = await params;

  const reception = await getReception(seller.id, Number(id));
  if (!reception) notFound();

  // Una recepcion ya confirmada no se vuelve a revisar: sus piezas ya estan
  // en el inventario y editarla aqui daria la impresion de poder deshacerla.
  if (reception.status !== "draft") redirect("/dashboard/inventory");

  const db = await getDb();
  const categories = await db
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .orderBy(asc(schema.categories.position), asc(schema.categories.name));

  const detected = reception.items.length;

  return (
    <PageShell>
      <PageHeader
        title="Revisa antes de cargar"
        subtitle={
          reception.source === "photo"
            ? `Leímos ${detected} ${detected === 1 ? "renglón" : "renglones"} de tu ticket. Nada se carga hasta que confirmes.`
            : "Agrega los códigos que recibiste. Nada se carga hasta que confirmes."
        }
      />
      <ReceptionReview
        receptionId={reception.id}
        items={reception.items}
        categories={categories}
        declaredItems={reception.declaredItems}
      />
    </PageShell>
  );
}
