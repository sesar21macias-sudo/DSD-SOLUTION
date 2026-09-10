import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/session";
import { getPointsBalanceByPhone } from "@/lib/loyalty";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Cuántos puntos tiene un teléfono con esta tienda — para verlo mientras se
 * arma una venta, antes de decidir si usarlos como pago.
 *
 * Nunca es un error que no tenga: un teléfono nuevo, un club apagado o una
 * cuenta en cero se ven todos igual — sin puntos que ofrecer.
 */
export async function GET(req: Request) {
  let seller;
  try {
    ({ seller } = await requireSeller());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Tu sesión expiró. Vuelve a entrar." },
      { status: 401 }
    );
  }

  const phone = (new URL(req.url).searchParams.get("phone") ?? "").trim();
  if (!phone) return NextResponse.json({ ok: true, balance: null });

  const limit = await rateLimit("points-lookup", `${seller.id}:${clientIp(req)}`, 120, 3600);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas consultas seguidas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const balance = await getPointsBalanceByPhone(seller.id, phone);
  return NextResponse.json({ ok: true, balance });
}
