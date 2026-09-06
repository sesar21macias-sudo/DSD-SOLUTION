import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSellerBySlug } from "@/lib/store";
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

  const title = `${seller.businessName} | NICE Joyería`;
  const description =
    seller.description?.trim() ||
    `Descubre la joyería NICE disponible con ${seller.businessName}${
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
        />
        {children}
      </div>
      <CartBar slug={slug} />
    </CartProvider>
  );
}
