import { NextResponse } from "next/server";
import { getSellerBySlug } from "@/lib/store";
import {
  CART_HOLD_MINUTES,
  ensureVisitorId,
  holdCartItems,
  releaseCartHolds,
  sweepExpired,
} from "@/lib/reservations";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Aparta las piezas de un carrito mientras alguien decide.
 *
 * Lo llama el carrito solo: al cambiar de contenido y cada minuto mientras la
 * pestaña siga abierta. Es idempotente —renueva en vez de acumular— asi que
 * llamarlo de mas no rompe nada.
 *
 * Es publico y escribe, igual que el de pedidos, asi que trae las mismas
 * defensas: limite por IP, tamaños acotados y **la disponibilidad se recalcula
 * aqui**. Del navegador solo se cree que codigos y cuantos.
 */

const MAX_LINES = 40;
const MAX_QTY = 99;

interface Body {
  items?: { niceCode?: unknown; quantity?: unknown }[];
  /** true = suelta todo, sin apartar nada. Se usa al vaciar el carrito. */
  release?: unknown;
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Mas alto que el de pedidos porque este endpoint se llama solo: un carrito
  // abierto una hora son 60 llamadas legitimas.
  const limit = await rateLimit("hold", clientIp(req), 120, 60);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas peticiones seguidas." },
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
    return NextResponse.json({ ok: false, error: "Petición ilegible." }, { status: 400 });
  }

  // Crea la cookie del visitante si es su primera vez. Es lo unico que
  // distingue "mis piezas apartadas" de "las de alguien mas".
  const visitorId = await ensureVisitorId();

  if (body.release === true) {
    await releaseCartHolds(seller.id, visitorId);
    return NextResponse.json({ ok: true, items: [], problems: [], expiresAt: null });
  }

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_LINES) : [];
  const lines = rawItems
    .map((i) => ({
      niceCode: typeof i?.niceCode === "string" ? i.niceCode.slice(0, 40) : "",
      quantity: Math.min(MAX_QTY, Math.max(0, Math.floor(Number(i?.quantity)) || 0)),
    }))
    .filter((i) => i.niceCode && i.quantity > 0);

  if (lines.length === 0) {
    await releaseCartHolds(seller.id, visitorId);
    return NextResponse.json({ ok: true, items: [], problems: [], expiresAt: null });
  }

  const result = await holdCartItems(seller.id, visitorId, lines);

  // Limpieza de paso. No hace falta para que las cuentas salgan —las consultas
  // ya ignoran lo vencido— pero evita que la tabla crezca sin fin, y este es el
  // endpoint que mas corre.
  await sweepExpired();

  return NextResponse.json({
    ok: true,
    expiresAt: result.expiresAt,
    holdMinutes: CART_HOLD_MINUTES,
    items: result.items.map((i) => ({
      niceCode: i.niceCode,
      name: i.name,
      held: i.held,
      requested: i.requested,
      available: i.available,
    })),
    problems: result.problems.map((i) => ({
      niceCode: i.niceCode,
      name: i.name,
      held: i.held,
      requested: i.requested,
      available: i.available,
      message:
        i.available <= 0
          ? `${i.name} la está comprando alguien más en este momento.`
          : i.available === 1
            ? `Solo queda 1 pieza libre de ${i.name}.`
            : `Solo quedan ${i.available} piezas libres de ${i.name}.`,
    })),
  });
}
