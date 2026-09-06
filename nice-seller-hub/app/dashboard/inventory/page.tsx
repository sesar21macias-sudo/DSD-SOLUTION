import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { listInventory, listMovements } from "@/lib/seller";
import { MOVEMENT_LABELS } from "@/lib/inventory";
import { formatDateTime } from "@/lib/format";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { InventoryTable } from "@/components/dashboard/InventoryTable";
import { Card, EmptyState, LinkButton, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { seller } = await requireSeller();
  const { q } = await searchParams;

  const [items, movements] = await Promise.all([
    listInventory(seller.id, q),
    listMovements(seller.id, 15),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Inventario"
        subtitle={`${items.length} ${items.length === 1 ? "pieza" : "piezas"} en tu tienda`}
        action={
          <LinkButton href="/dashboard/inventory/new" size="sm">
            <Plus size={15} strokeWidth={2} />
            Agregar
          </LinkButton>
        }
      />

      {items.length === 0 && !q ? (
        <EmptyState
          icon={<Package size={30} strokeWidth={1.3} />}
          title="Tu inventario está vacío"
          description="Agrega tus primeras piezas para que aparezcan en tu tienda y tus clientes puedan pedirlas."
          action={
            <LinkButton href="/dashboard/inventory/new">
              <Plus size={16} strokeWidth={2} />
              Agregar mi primera pieza
            </LinkButton>
          }
        />
      ) : (
        <InventoryTable items={items} initialQuery={q ?? ""} slug={seller.slug} />
      )}

      {movements.length > 0 && (
        <section className="mt-10">
          <SectionTitle>Movimientos recientes</SectionTitle>
          <Card className="divide-y divide-line">
            {movements.map((m) => (
              <div key={m.id} className="flex items-baseline gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">
                    <span className="font-medium">{MOVEMENT_LABELS[m.type] ?? m.type}</span>
                    <span className="text-mute"> · {m.productName}</span>
                  </p>
                  <p className="text-[11px] text-mute">
                    {formatDateTime(m.createdAt)}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </p>
                </div>
                {m.delta !== 0 && (
                  <span className="shrink-0 text-[12px] tabular-nums text-mute">
                    {m.stockBefore} → {m.stockAfter}
                  </span>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}
    </PageShell>
  );
}
