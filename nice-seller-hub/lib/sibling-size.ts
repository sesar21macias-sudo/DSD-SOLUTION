import "server-only";

import { and, like, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { baseCode, ringSize } from "./nice-code";

/**
 * Otra talla del mismo anillo que ya esté en el catálogo global.
 *
 * La tienda de NICE no lista todas las tallas: de `426307` solo publica la 6,
 * así que `426307/8` no se resuelve contra su sitio por más que exista en la
 * mano de la distribuidora. Pero es el **mismo anillo** — misma foto, mismo
 * nombre, mismo precio de catálogo; lo único que cambia es la talla.
 *
 * Así que la primera talla que entra resuelve contra NICE, y las siguientes se
 * copian de ella. Sin esto, cada talla nueva llegaría al inventario sin foto y
 * sin nombre, que es justo el trabajo que este sistema existe para quitar.
 */
export async function findSiblingSize(code: string) {
  const size = ringSize(code);
  if (!size) return null;

  const model = baseCode(code);
  const db = await getDb();

  const rows = await db
    .select({
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      description: schema.products.description,
      imageUrl: schema.products.imageUrl,
      suggestedPriceCents: schema.products.suggestedPriceCents,
      categoryId: schema.products.categoryId,
      material: schema.products.material,
      finish: schema.products.finish,
      gallery: schema.products.gallery,
    })
    .from(schema.products)
    .where(
      and(
        like(schema.products.niceCode, `${model}/%`),
        ne(schema.products.niceCode, code)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}
