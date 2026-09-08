import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSellerBySlug } from "@/lib/store";
import { getMember } from "@/lib/member";
import { getProgram, listCustomerRedemptions } from "@/lib/loyalty";
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

  const program = await getProgram(seller.id);
  const member = program.enabled ? await getMember(seller.id) : null;

  // Solo los cupones de esta persona y de esta tienda. La validacion de verdad
  // vuelve a ocurrir en el servidor al generar el pedido: esta lista es para
  // que ella los pueda elegir, no la que decide el descuento.
  const coupons = member
    ? (await listCustomerRedemptions(seller.id, member.customer.id))
        .filter((c) => c.status === "available")
        .map((c) => ({ code: c.code, name: c.nameSnapshot, kind: c.kind, value: c.value }))
    : [];

  // Solo lo publico de la distribuidora llega al navegador. El WhatsApp si va
  // —es el punto de todo esto— pero nada de ventas, clientes ni costos.
  return (
    <CheckoutView
      slug={slug}
      businessName={seller.businessName}
      city={seller.city}
      deliveryMethods={seller.deliveryMethods}
      paymentMethods={seller.paymentMethods}
      clubEnabled={program.enabled}
      clubName={program.name}
      memberName={member?.customer.name ?? null}
      memberPoints={member?.points ?? null}
      coupons={coupons}
    />
  );
}
