import { NextResponse } from "next/server";
import { getSellerBySlug } from "@/lib/store";
import { createOrder, getOrderByNumber } from "@/lib/orders";
import { buildOrderMessage, firstName, waLink } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/phone";
import { findOrCreateCustomer } from "@/lib/mutations";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Genera el pedido y devuelve el enlace de WhatsApp ya armado.
 *
 * Este es el unico endpoint publico que escribe, asi que aqui se concentra la
 * desconfianza: se limita por IP, se acotan los tamaños, y **el precio, el
 * nombre y las existencias se vuelven a leer de la base**. Nada de lo que
 * manda el navegador sobre dinero o disponibilidad se cree: el carrito solo
 * dice que codigos y cuantos.
 */

const MAX_LINES = 40;
const MAX_QTY = 99;

interface Body {
  items?: { niceCode?: unknown; quantity?: unknown }[];
  name?: unknown;
  phone?: unknown;
  note?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const limit = await rateLimit("orders", clientIp(req), 12, 60);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Muchos intentos seguidos. Espera un momento e inténtalo otra vez." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const seller = await getSellerBySlug(slug);
  if (!seller) {
    return NextResponse.json({ ok: false, error: "Esta tienda no existe." }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido ilegible." }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_LINES) : [];
  const lines = rawItems
    .map((i) => ({
      niceCode: typeof i?.niceCode === "string" ? i.niceCode.slice(0, 40) : "",
      quantity: Math.min(MAX_QTY, Math.max(0, Math.floor(Number(i?.quantity)) || 0)),
    }))
    .filter((i) => i.niceCode && i.quantity > 0);

  if (lines.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Tu pedido está vacío." },
      { status: 400 }
    );
  }

  const contactName = str(body.name, 80);
  const contactPhoneRaw = str(body.phone, 20);
  const note = str(body.note, 300);

  // Si dejo su telefono, se guarda al cliente en la cartera de esta tienda.
  // Si no, el pedido se registra como invitado: obligar a registrarse para
  // mandar un mensaje por WhatsApp es la mejor forma de perder la venta.
  let customerId: number | null = null;
  let contactPhone: string | null = null;

  if (contactPhoneRaw) {
    const normalized = normalizePhone(contactPhoneRaw);
    if (normalized.ok) {
      contactPhone = normalized.value;
      if (contactName) {
        const customer = await findOrCreateCustomer(
          seller.id,
          contactName,
          normalized.value
        );
        if (customer.ok) customerId = customer.customerId;
      }
    }
  }

  const result = await createOrder(
    seller.id,
    lines,
    { name: contactName, phone: contactPhone, note },
    customerId
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "El inventario cambió mientras armabas tu pedido.",
        problems: result.problems.map((p) => ({ name: p.name, message: p.message })),
      },
      { status: 409 }
    );
  }

  // El mensaje se arma con lo que quedo guardado en el pedido, no con lo que
  // mando el navegador: es la misma fuente que vera la distribuidora.
  const order = await getOrderByNumber(seller.id, result.orderNumber);
  if (!order) {
    return NextResponse.json(
      { ok: false, error: "No pudimos generar tu pedido. Intenta otra vez." },
      { status: 500 }
    );
  }

  const message = buildOrderMessage({
    sellerFirstName: firstName(seller.businessName),
    orderNumber: order.orderNumber,
    items: order.items.map((i) => ({
      name: i.name,
      code: i.code,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    totalCents: order.totalCents,
    customerName: contactName,
    note,
  });

  return NextResponse.json({
    ok: true,
    orderNumber: order.orderNumber,
    waUrl: waLink(seller.whatsapp, message),
  });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}
