import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSellerBySlug } from "@/lib/store";
import { CartView } from "@/components/store/CartView";

export const metadata: Metadata = { title: "Mi pedido" };
export const dynamic = "force-dynamic";

export default async function CartPage({ params }: { params: Promise<{ seller: string }> }) {
  const { seller: slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  return <CartView slug={slug} businessName={seller.businessName} />;
}
