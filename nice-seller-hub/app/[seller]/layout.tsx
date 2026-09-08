import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSellerBySlug } from "@/lib/store";
import { getProgram } from "@/lib/loyalty";
import { CartProvider } from "@/components/cart/CartProvider";
import { StoreHeader } from "@/components/store/StoreHeader";
import { CartBar } from "@/components/store/CartBar";

/**
 * Todo lo que cuelga de /{slug} pertenece a una sola distribuidora. El
 * CartProvider recibe el slug, y con eso el carrito queda separado del de
 * cualquier otra tienda que la persona haya visitado.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seller: string }>;
}): Promise<Metadata> {
  const { seller: slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) return { title: "Tienda no encontrada" };

  // El titulo es el nombre de su tienda y nada mas. Ponerle una marca que
  // no es suya la anunciaba como sucursal de alguien mas.
  const title = seller.tagline?.trim()
    ? `${seller.businessName} · ${seller.tagline.trim()}`
    : seller.businessName;
  const description =
    seller.description?.trim() ||
    `Descubre las piezas disponibles con ${seller.businessName}${
      seller.city ? ` en ${seller.city}` : ""
    }.`;

  return {
    title,
    description,
    // La vista previa al compartir por WhatsApp o Facebook es parte del
    // producto: es lo primero que ve el cliente de la tienda.
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_MX",
      images: seller.profileImage ? [{ url: seller.profileImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ seller: string }>;
}) {
  const { seller: slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  // El club solo aparece en la tienda si esta encendido: un enlace a una
  // pagina que dice "esta tienda no tiene club" no le sirve a nadie.
  const program = await getProgram(seller.id);

  return (
    <CartProvider slug={slug}>
      <div className="min-h-dvh pb-28">
        <StoreHeader
          slug={slug}
          businessName={seller.businessName}
          city={seller.city}
          state={seller.state}
          description={seller.description}
          profileImage={seller.profileImage}
          whatsapp={seller.whatsapp}
          instagram={seller.instagram}
          facebook={seller.facebook}
          tagline={seller.tagline}
          coverImage={seller.coverImage}
          clubName={program.enabled ? program.name : null}
          shareMessageTemplate={seller.shareMessageTemplate}
        />
        {children}
      </div>
      <CartBar slug={slug} />
    </CartProvider>
  );
}
