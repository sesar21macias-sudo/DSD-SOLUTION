import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSellerBySlug, getStoreProduct, listRelated } from "@/lib/store";
import { STATUS_LABELS, stockHint } from "@/lib/inventory";
import { formatMoney } from "@/lib/format";
import { AddToCartPanel } from "@/components/store/AddToCart";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductCard } from "@/components/store/ProductCard";
import { StatusDot } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seller: string; code: string }>;
}): Promise<Metadata> {
  const { seller: slug, code } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) return { title: "No encontrado" };

  const product = await getStoreProduct(seller.id, code);
  if (!product) return { title: "Pieza no encontrada" };

  return {
    title: `${product.name} · ${product.niceCode}`,
    description:
      product.description?.trim() ||
      `${product.name}, código NICE ${product.niceCode}, disponible con ${seller.businessName}.`,
    openGraph: {
      title: `${product.name} | ${seller.businessName}`,
      description: `${formatMoney(product.priceCents)} MXN · Código ${product.niceCode}`,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ seller: string; code: string }>;
}) {
  const { seller: slug, code } = await params;

  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  const product = await getStoreProduct(seller.id, code);
  if (!product) notFound();

  const status = STATUS_LABELS[product.status];
  const related = await listRelated(seller.id, product.categoryId, product.productId);

  // La galeria se guarda como JSON; si viene corrupta se ignora en vez de
  // tumbar la pagina por una comilla mal puesta.
  let gallery: string[] = [];
  try {
    const parsed = product.gallery ? JSON.parse(product.gallery) : [];
    if (Array.isArray(parsed)) gallery = parsed.filter((u) => typeof u === "string");
  } catch {
    gallery = [];
  }

  const images = [product.imageUrl, ...gallery].filter((u): u is string => Boolean(u));

  return (
    <main className="mx-auto max-w-3xl px-5 pb-12">
      <ProductGallery images={images} alt={product.name} />

      <div className="animate-fade-up mt-6">
        {product.categoryName && (
          <Link
            href={`/${slug}?category=${product.categorySlug}`}
            className="text-[12px] font-medium uppercase tracking-[0.14em] text-gold transition-opacity hover:opacity-70"
          >
            {product.categoryName}
          </Link>
        )}

        <h1 className="mt-2 text-[28px] font-light leading-tight sm:text-[34px]">{product.name}</h1>

        <p className="mt-1.5 text-[13px] tabular-nums text-mute">Código NICE {product.niceCode}</p>

        <p className="mt-5 text-[26px] font-medium tabular-nums">
          {formatMoney(product.priceCents)}
          <span className="ml-1.5 text-[13px] font-normal text-mute">MXN</span>
        </p>

        <p className="mt-3 flex items-center gap-2 text-[14px]">
          <StatusDot className={status.dot} />
          <span className={status.text}>{status.label}</span>
          {status.buyable && <span className="text-mute">· {stockHint(product.stock)}</span>}
        </p>
      </div>

      <div className="animate-fade-up mt-7">
        <AddToCartPanel
          item={{
            niceCode: product.niceCode,
            name: product.name,
            imageUrl: product.imageUrl,
            priceCents: product.priceCents,
            stock: product.stock,
          }}
          buyable={status.buyable}
        />
      </div>

      {product.description && (
        <p className="animate-fade-up mt-8 text-[15px] leading-relaxed text-ink-soft">
          {product.description}
        </p>
      )}

      {(product.material || product.finish) && (
        <dl className="animate-fade-up mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {product.material && <SpecRow label="Material" value={product.material} />}
          {product.finish && <SpecRow label="Acabado" value={product.finish} />}
        </dl>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <p className="text-[12px] uppercase tracking-[0.14em] text-mute">Vendido por</p>
        <p className="mt-1.5 text-[15px] font-medium">{seller.businessName}</p>
        {seller.city && <p className="text-[13px] text-mute">{seller.city}</p>}
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-[17px] font-semibold">Más de {product.categoryName}</h2>
          <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {related.map((p) => (
              <ProductCard key={p.inventoryId} product={p} slug={slug} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-surface px-4 py-3">
      <dt className="text-[13px] text-mute">{label}</dt>
      <dd className="text-[14px] font-medium">{value}</dd>
    </div>
  );
}
