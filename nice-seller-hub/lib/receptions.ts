import "server-only";

import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { TicketLine } from "./ocr";
import { outer } from "./sql-helpers";

/**
 * Recepcion de mercancia.
 *
 * El principio que ordena todo este archivo: **el OCR nunca escribe en el
 * inventario**. Crea un borrador, una persona lo revisa, y solo al confirmar
 * se mueven existencias. Entre esos dos momentos se puede corregir un codigo,
 * cambiar una cantidad, poner precio o descartar un renglon.
 *
 * Como en el resto del panel, cada funcion recibe `sellerId` y lo mete en el
 * WHERE. Un id de recepcion ajeno no encuentra nada.
 */

export type ReceptionStatus = "draft" | "confirmed" | "cancelled";
export type ItemStatus = "matched" | "not_found" | "skipped";

export interface ReceptionItemView {
  id: number;
  niceCode: string;
  quantity: number;
  productId: number | null;
  priceCents: number | null;
  status: ItemStatus;
  rawLine: string | null;
  confidence: string;
  catalogPriceCents: number | null;
  nameHint: string | null;
  /** Datos que vienen del catalogo global, no de la distribuidora. */
  name: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  description: string | null;
  suggestedPriceCents: number | null;
  /** Cuantas tiene ya en su inventario, para saber si suma o da de alta. */
  currentStock: number | null;
}

export interface ReceptionView {
  id: number;
  status: ReceptionStatus;
  source: string;
  createdAt: string;
  confirmedAt: string | null;
  /** El "TOTAL ARTICULOS" del ticket, para cotejar contra lo leído. */
  declaredItems: number | null;
  items: ReceptionItemView[];
}

/**
 * En papel térmico, `1`, `I` y `L` se ven casi idénticos, y `O` con `0`. En un
 * Id Nice que termina en letra de variante, esa confusión es la falla más común
 * de todo el flujo.
 *
 * La clave normalizada colapsa esos caracteres para poder reconocer la pieza de
 * todos modos. Solo se usa cuando el código exacto no existe **y** un único
 * producto del catálogo normaliza igual: si dos coinciden, no se adivina.
 */
function normalizedKey(code: string): string {
  return code.toUpperCase().replace(/[OQ]/g, "0").replace(/[IL]/g, "1");
}

/** La misma normalización, del lado de SQLite. */
const SQL_NORMALIZED_CODE = sql<string>`replace(replace(replace(replace(upper(${schema.products.niceCode}), 'O', '0'), 'Q', '0'), 'I', '1'), 'L', '1')`;

/**
 * Convierte lo que se leyo del ticket en un borrador.
 *
 * Cada codigo se busca en el catalogo global —exacto primero, y si no, por
 * clave normalizada—. Si existe, el renglon queda `matched` y hereda nombre,
 * foto y precio; si no, queda `not_found` y la persona decide si lo busca a
 * mano, lo da de alta o lo descarta.
 */
export async function createDraftReception(
  sellerId: number,
  lines: TicketLine[],
  source: "photo" | "manual",
  declaredItems: number | null = null
): Promise<number> {
  const db = await getDb();

  const codes = [...new Set(lines.map((l) => l.code))];

  const found = codes.length
    ? await db
        .select({
          id: schema.products.id,
          niceCode: schema.products.niceCode,
          suggestedPriceCents: schema.products.suggestedPriceCents,
        })
        .from(schema.products)
        .where(inArray(schema.products.niceCode, codes))
    : [];

  const byCode = new Map(found.map((p) => [p.niceCode, p]));

  // Segunda pasada, solo para los que no dieron coincidencia exacta.
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length > 0) {
    const keys = [...new Set(missing.map(normalizedKey))];
    const fuzzy = await db
      .select({
        id: schema.products.id,
        niceCode: schema.products.niceCode,
        suggestedPriceCents: schema.products.suggestedPriceCents,
        key: SQL_NORMALIZED_CODE.as("normalized_key"),
      })
      .from(schema.products)
      .where(inArray(SQL_NORMALIZED_CODE, keys));

    // Si dos piezas del catálogo normalizan igual, la ambigüedad es real y se
    // deja sin resolver: es mejor un "no encontrado" que la pieza equivocada.
    const countByKey = new Map<string, number>();
    for (const p of fuzzy) countByKey.set(p.key, (countByKey.get(p.key) ?? 0) + 1);

    const uniqueByKey = new Map(
      fuzzy.filter((p) => countByKey.get(p.key) === 1).map((p) => [p.key, p])
    );

    for (const code of missing) {
      const match = uniqueByKey.get(normalizedKey(code));
      if (match) byCode.set(code, match);
    }
  }

  // Lo que ya tiene en su inventario: si el precio ya lo definio antes, se
  // respeta. Cambiarselo por el de catalogo cada vez que recibe mercancia
  // seria deshacerle una decision suya sin avisar.
  // Sale de `byCode`, no de `found`: si no, las piezas resueltas por clave
  // normalizada perderían el precio que ella ya les tenía puesto.
  const productIds = [...new Set([...byCode.values()].map((p) => p.id))];
  const existing = productIds.length
    ? await db
        .select({
          productId: schema.sellerInventory.productId,
          priceCents: schema.sellerInventory.priceCents,
        })
        .from(schema.sellerInventory)
        .where(
          and(
            eq(schema.sellerInventory.sellerId, sellerId),
            inArray(schema.sellerInventory.productId, productIds)
          )
        )
    : [];

  const priceByProduct = new Map(existing.map((e) => [e.productId, e.priceCents]));

  const inserted = await db
    .insert(schema.receptions)
    .values({ sellerId, status: "draft", source, declaredItems })
    .returning({ id: schema.receptions.id });

  const receptionId = inserted[0].id;

  if (lines.length > 0) {
    await db.insert(schema.receptionItems).values(
      lines.map((l) => {
        const product = byCode.get(l.code);
        return {
          receptionId,
          // Si el catálogo resolvió el código, se guarda el del catálogo: es el
          // que existe de verdad, no la transcripción dudosa del papel.
          niceCode: product?.niceCode ?? l.code,
          quantity: l.quantity,
          productId: product?.id ?? null,
          /**
           * El precio se prellena en este orden: el que ella ya le puso a esa
           * pieza, luego el del catálogo global, y por último el que viene
           * impreso en el ticket. Nunca se le pisa una decisión suya.
           */
          priceCents: product
            ? (priceByProduct.get(product.id) ??
               product.suggestedPriceCents ??
               l.catalogPriceCents ??
               null)
            : l.catalogPriceCents,
          catalogPriceCents: l.catalogPriceCents,
          nameHint: l.description || null,
          status: product ? "matched" : "not_found",
          rawLine: l.rawLine || null,
          // Un código resuelto por normalización nunca es "high": el carácter
          // dudoso sigue siendo dudoso, aunque hayamos encontrado candidato.
          confidence:
            product && product.niceCode !== l.code ? "low" : l.confidence,
        };
      })
    );
  }

  return receptionId;
}

/** Una recepcion con sus renglones, acotada a esta tienda. */
export async function getReception(
  sellerId: number,
  receptionId: number
): Promise<ReceptionView | null> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(schema.receptions)
    .where(
      and(eq(schema.receptions.id, receptionId), eq(schema.receptions.sellerId, sellerId))
    )
    .limit(1);

  const reception = rows[0];
  if (!reception) return null;

  const items = await db
    .select({
      id: schema.receptionItems.id,
      niceCode: schema.receptionItems.niceCode,
      quantity: schema.receptionItems.quantity,
      productId: schema.receptionItems.productId,
      priceCents: schema.receptionItems.priceCents,
      status: schema.receptionItems.status,
      rawLine: schema.receptionItems.rawLine,
      confidence: schema.receptionItems.confidence,
      catalogPriceCents: schema.receptionItems.catalogPriceCents,
      nameHint: schema.receptionItems.nameHint,
      name: schema.products.name,
      imageUrl: schema.products.imageUrl,
      description: schema.products.description,
      suggestedPriceCents: schema.products.suggestedPriceCents,
      categoryName: schema.categories.name,
      currentStock: sql<number | null>`(
        select stock from seller_inventory
        where seller_id = ${sellerId} and product_id = ${outer("reception_items", "product_id")}
      )`.as("current_stock"),
    })
    .from(schema.receptionItems)
    .leftJoin(schema.products, eq(schema.products.id, schema.receptionItems.productId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(eq(schema.receptionItems.receptionId, receptionId))
    .orderBy(asc(schema.receptionItems.id));

  return {
    id: reception.id,
    status: reception.status as ReceptionStatus,
    source: reception.source,
    createdAt: reception.createdAt,
    confirmedAt: reception.confirmedAt,
    declaredItems: reception.declaredItems,
    items: items.map((i) => ({ ...i, status: i.status as ItemStatus })),
  };
}

/**
 * Verifica que un renglon pertenezca a un borrador de esta tienda.
 * Devuelve el id de la recepcion, o null.
 *
 * Toda edicion de renglon pasa por aqui: es lo que impide que alguien mande el
 * id de un renglon de otra distribuidora, o edite una recepcion ya confirmada
 * —lo cual reescribiria historia que ya movio inventario—.
 */
export async function assertDraftItem(
  sellerId: number,
  itemId: number
): Promise<number | null> {
  const db = await getDb();
  const rows = await db
    .select({ receptionId: schema.receptions.id })
    .from(schema.receptionItems)
    .innerJoin(schema.receptions, eq(schema.receptions.id, schema.receptionItems.receptionId))
    .where(
      and(
        eq(schema.receptionItems.id, itemId),
        eq(schema.receptions.sellerId, sellerId),
        eq(schema.receptions.status, "draft")
      )
    )
    .limit(1);
  return rows[0]?.receptionId ?? null;
}

export interface CatalogMatch {
  id: number;
  niceCode: string;
  name: string;
  imageUrl: string | null;
  categoryName: string | null;
  suggestedPriceCents: number | null;
}

/** Busca en el catalogo global, para resolver a mano un codigo no encontrado. */
export async function searchCatalog(query: string, limit = 8): Promise<CatalogMatch[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const db = await getDb();
  const needle = `%${q}%`;

  return db
    .select({
      id: schema.products.id,
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      imageUrl: schema.products.imageUrl,
      categoryName: schema.categories.name,
      suggestedPriceCents: schema.products.suggestedPriceCents,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(
      or(
        like(sql`lower(${schema.products.niceCode})`, needle),
        like(sql`lower(${schema.products.name})`, needle)
      )
    )
    .orderBy(asc(schema.products.name))
    .limit(limit);
}

export interface ConfirmResult {
  added: number;
  increased: number;
  pieces: number;
  skipped: number;
}

/**
 * Confirma la recepcion: **este es el unico momento en que se toca el
 * inventario**, y ocurre porque una persona lo pidió, no porque el OCR haya
 * leído algo.
 *
 * Los renglones sin producto o sin precio se omiten en vez de detener todo: si
 * de veinte piezas dos quedaron sin resolver, es mejor cargar dieciocho y
 * decirle cuáles faltaron que dejarla sin nada.
 *
 * Si el mismo código viene en dos renglones, las cantidades se suman: es lo que
 * la persona vio en su ticket y es lo que espera en su inventario.
 */
export async function confirmReception(
  sellerId: number,
  receptionId: number
): Promise<{ ok: true; result: ConfirmResult } | { ok: false; error: string }> {
  const db = await getDb();

  const reception = await getReception(sellerId, receptionId);
  if (!reception) return { ok: false, error: "No encontramos esa recepción." };
  if (reception.status !== "draft") {
    return { ok: false, error: "Esta recepción ya se había confirmado." };
  }

  // Agrupar por producto antes de escribir.
  const byProduct = new Map<number, { quantity: number; priceCents: number }>();
  let skipped = 0;

  for (const item of reception.items) {
    if (item.status === "skipped" || item.productId === null || item.quantity <= 0) {
      skipped++;
      continue;
    }
    const price = item.priceCents ?? item.suggestedPriceCents;
    if (!price || price <= 0) {
      // Sin precio no se puede publicar: aparecería en la tienda en $0.
      skipped++;
      continue;
    }
    const current = byProduct.get(item.productId);
    byProduct.set(item.productId, {
      quantity: (current?.quantity ?? 0) + item.quantity,
      priceCents: current?.priceCents ?? price,
    });
  }

  if (byProduct.size === 0) {
    return {
      ok: false,
      error: "No hay ninguna pieza lista para agregar. Revisa los códigos y los precios.",
    };
  }

  const productIds = [...byProduct.keys()];
  const existing = await db
    .select({
      id: schema.sellerInventory.id,
      productId: schema.sellerInventory.productId,
      stock: schema.sellerInventory.stock,
    })
    .from(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        inArray(schema.sellerInventory.productId, productIds)
      )
    );

  const existingByProduct = new Map(existing.map((e) => [e.productId, e]));
  const nowIso = new Date().toISOString();

  let added = 0;
  let increased = 0;
  let pieces = 0;

  for (const [productId, line] of byProduct) {
    const current = existingByProduct.get(productId);
    pieces += line.quantity;

    if (current) {
      // Ya la tiene: se suma. El precio NO se toca — ya era decisión suya.
      const after = current.stock + line.quantity;
      await db
        .update(schema.sellerInventory)
        .set({ stock: after, updatedAt: nowIso })
        .where(
          and(
            eq(schema.sellerInventory.id, current.id),
            eq(schema.sellerInventory.sellerId, sellerId)
          )
        );

      await db.insert(schema.inventoryMovements).values({
        sellerId,
        productId,
        type: "increase",
        delta: line.quantity,
        stockBefore: current.stock,
        stockAfter: after,
        reason: "Recepción de mercancía",
        referenceId: receptionId,
      });
      increased++;
    } else {
      await db.insert(schema.sellerInventory).values({
        sellerId,
        productId,
        priceCents: line.priceCents,
        stock: line.quantity,
        isVisible: true,
      });

      await db.insert(schema.inventoryMovements).values({
        sellerId,
        productId,
        type: "add",
        delta: line.quantity,
        stockBefore: 0,
        stockAfter: line.quantity,
        reason: "Recepción de mercancía",
        referenceId: receptionId,
      });
      added++;
    }
  }

  await db
    .update(schema.receptions)
    .set({ status: "confirmed", confirmedAt: nowIso })
    .where(
      and(eq(schema.receptions.id, receptionId), eq(schema.receptions.sellerId, sellerId))
    );

  return { ok: true, result: { added, increased, pieces, skipped } };
}

/** Borradores abiertos, para que no se le pierda uno a medio revisar. */
export async function listOpenReceptions(sellerId: number) {
  const db = await getDb();
  return db
    .select({
      id: schema.receptions.id,
      createdAt: schema.receptions.createdAt,
      items: sql<number>`(
        select count(*) from reception_items where reception_id = ${outer("receptions", "id")}
      )`.as("item_count"),
    })
    .from(schema.receptions)
    .where(
      and(eq(schema.receptions.sellerId, sellerId), eq(schema.receptions.status, "draft"))
    )
    .orderBy(desc(schema.receptions.createdAt))
    .limit(5);
}
