import { NextResponse } from "next/server";
import { getSellerBySlug } from "@/lib/store";
import { getOrderByNumber, markWhatsAppSent } from "@/lib/orders";

/**
 * Marca que el cliente si abrio WhatsApp con su pedido.
 *
 * Solo avanza de "pending" a "whatsapp_sent"; no puede cambiar ningun otro
 * estado. Aunque alguien adivinara un folio ajeno, lo unico que lograria es
 * marcar como enviado un pedido que de todos modos existe.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; number: string }> }
) {
  const { slug, number } = await params;

  const seller = await getSellerBySlug(slug);
  if (!seller) return NextResponse.json({ ok: false }, { status: 404 });

  const order = await getOrderByNumber(seller.id, number);
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });

  await markWhatsAppSent(order.id);
  return NextResponse.json({ ok: true });
}
