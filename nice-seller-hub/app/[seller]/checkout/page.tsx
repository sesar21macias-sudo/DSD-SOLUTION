import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSellerBySlug } from "@/lib/store";
import { CheckoutView } from "@/components/store/CheckoutView";

export const metadata: Metadata = { title: "Confirmar pedido" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ seller: string }>;
}) {
  const { seller: slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  // Solo lo publico de la distribuidora llega al navegador. El WhatsApp si va
  // —es el punto de todo esto— pero nada de ventas, clientes ni costos.
  return (
    <CheckoutView
      slug={slug}
      businessName={seller.businessName}
      city={seller.city}
      deliveryMethods={seller.deliveryMethods}
      paymentMethods={seller.paymentMethods}
    />
  );
}
