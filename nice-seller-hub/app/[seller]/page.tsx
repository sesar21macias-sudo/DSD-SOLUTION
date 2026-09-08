import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PackageSearch } from "lucide-react";
import {
  getSellerBySlug,
  listStoreCategories,
  listStoreFinishes,
  listStoreProducts,
  type StoreFilters,
} from "@/lib/store";
import { ProductCard } from "@/components/store/ProductCard";
import { Filters } from "@/components/store/Filters";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * El catalogo de una distribuidora. Se renderiza en el servidor: la primera
 * pantalla llega con las fotos ya en el HTML, que es lo que hace la diferencia
 * en un telefono con senal irregular.
 */
export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { seller: slug } = await params;
  const sp = await searchParams;

  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  const filters: StoreFilters = {
    q: str(sp.q),
    category: str(sp.category),
    finish: str(sp.finish),
    availability: str(sp.availability) === "all" ? "all" : "available",
    sort: (str(sp.sort) as StoreFilters["sort"]) ?? "recent",
  };

  const [products, categories, finishes] = await Promise.all([
    listStoreProducts(seller.id, filters),
    listStoreCategories(seller.id),
    listStoreFinishes(seller.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-5">
      <Suspense fallback={<div className="h-11" />}>
        <Filters categories={categories} finishes={finishes} total={products.length} />
      </Suspense>

      {products.length === 0 ? (
        <EmptyState
          icon={<PackageSearch size={30} strokeWidth={1.3} />}
          title={filters.q ? "No encontramos esa pieza" : "Esta tienda todavía no tiene piezas"}
          description={
            filters.q
              ? `Nada coincide con "${filters.q}". Prueba con otro nombre o con el código de la pieza.`
              : `${seller.businessName} está preparando su inventario. Vuelve pronto.`
          }
        />
      ) : (
        <ul className="stagger grid grid-cols-2 gap-3 pb-8 sm:grid-cols-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.inventoryId} product={p} slug={slug} />
          ))}
        </ul>
      )}
    </main>
  );
}

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}
