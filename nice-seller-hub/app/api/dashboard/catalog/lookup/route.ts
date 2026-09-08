import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import { lookupNiceProduct } from "@/lib/nice-catalog";
import { findSiblingSize } from "@/lib/sibling-size";
import { NICE_CODE_RE } from "@/lib/nice-code";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Qué sabemos de un Id Nice: primero nuestro catálogo, y si no está, la tienda
 * oficial de NICE.
 *
 * Lo usa el alta manual de una pieza: la distribuidora escribe el código y el
 * nombre, la foto y el precio se llenan solos. Es el mismo resolvedor que usa
 * la recepción por foto, aplicado al camino de captura a mano.
 *
 * Solo lee. Nada de lo que devuelve entra al inventario sin que ella guarde.
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

  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!NICE_CODE_RE.test(code)) {
    return NextResponse.json({ ok: false, error: "Ese código no se ve válido." }, { status: 400 });
  }

  // Cada consulta a NICE son varias peticiones a su tienda. El límite protege
  // tanto a este Worker como a ellos.
  const limit = await rateLimit("catalog", `${seller.id}:${clientIp(req)}`, 60, 3600);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas búsquedas seguidas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const db = await getDb();
  const local = await db
    .select({
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      description: schema.products.description,
      imageUrl: schema.products.imageUrl,
      suggestedPriceCents: schema.products.suggestedPriceCents,
      categoryId: schema.products.categoryId,
    })
    .from(schema.products)
    .where(eq(schema.products.niceCode, code))
    .limit(1);

  if (local[0]) {
    return NextResponse.json({ ok: true, source: "catalogo", product: local[0] });
  }

  /**
   * Antes de salir a internet, otra talla del mismo anillo que ya tengamos.
   * Es la misma pieza y ahorra una consulta a la tienda de NICE — que ademas
   * no lista todas las tallas.
   */
  const sibling = await findSiblingSize(code);
  if (sibling) {
    return NextResponse.json({
      ok: true,
      source: "talla",
      product: {
        niceCode: code,
        name: sibling.name,
        description: sibling.description,
        imageUrl: sibling.imageUrl,
        suggestedPriceCents: sibling.suggestedPriceCents,
        categoryId: sibling.categoryId,
      },
    });
  }

  const found = await lookupNiceProduct(code);
  if (!found) {
    return NextResponse.json(
      { ok: false, error: "No encontramos ese código en el catálogo de NICE." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    source: "nice",
    product: {
      niceCode: found.sku,
      name: found.name,
      description: found.description,
      imageUrl: found.imageUrl,
      suggestedPriceCents: found.priceCents,
      categoryId: null,
    },
  });
}
