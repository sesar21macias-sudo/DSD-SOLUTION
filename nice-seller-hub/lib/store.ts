import "server-only";

import { and, asc, desc, eq, gt, gte, like, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Seller } from "@/db/schema";
import { stockStatus, type StockStatus } from "./inventory";

/**
 * Consultas de la tienda publica. Solo leen, solo devuelven lo que puede ver
 * cualquiera: nada de telefonos de clientes, ventas ni costos.
 *
 * Todas acotan por `sellerId`, que sale del slug de la URL. Una tienda no
 * puede mostrar el inventario de otra ni por accidente.
 */

export interface StoreProduct {
  inventoryId: number;
  productId: number;
  niceCode: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  gallery: string | null;
  material: string | null;
  finish: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  priceCents: number;
  stock: number;
  status: StockStatus;
}

export interface StoreFilters {
  q?: string;
  category?: string;
  /** "all" | "available" — por omision se ocultan los agotados. */
  availability?: "all" | "available";
  finish?: string;
  minCents?: number;
  maxCents?: number;
  sort?: "recent" | "price_asc" | "price_desc" | "best_sellers";
}

export async function getSellerBySlug(slug: string): Promise<Seller | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.sellers)
    .where(and(eq(schema.sellers.slug, slug), eq(schema.sellers.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * El catalogo visible de una tienda. `isVisible = false` no sale nunca: es la
 * forma que tiene la distribuidora de guardar una pieza sin borrarla.
 */
export async function listStoreProducts(
  sellerId: number,
  filters: StoreFilters = {}
): Promise<StoreProduct[]> {
  const db = await getDb();

  const conditions = [
    eq(schema.sellerInventory.sellerId, sellerId),
    eq(schema.sellerInventory.isVisible, true),
  ];

  if (filters.availability !== "all") {
    conditions.push(gt(schema.sellerInventory.stock, 0));
  }
  if (filters.category) {
    conditions.push(eq(schema.categories.slug, filters.category));
  }
  if (filters.finish) {
    conditions.push(eq(schema.products.finish, filters.finish));
  }
  if (typeof filters.minCents === "number") {
    conditions.push(gte(schema.sellerInventory.priceCents, filters.minCents));
  }
  if (typeof filters.maxCents === "number") {
    conditions.push(lte(schema.sellerInventory.priceCents, filters.maxCents));
  }
  if (filters.q) {
    // Se busca por nombre y por codigo NICE, que es como la gente pide las
    // piezas: unas veces "collar de eslabones", otras "826031".
    const needle = `%${filters.q.trim().toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${schema.products.name})`, needle),
        like(sql`lower(${schema.products.niceCode})`, needle),
        like(sql`lower(${schema.categories.name})`, needle)
      )!
    );
  }

  const orderBy = (() => {
    switch (filters.sort) {
      case "price_asc":
        return [asc(schema.sellerInventory.priceCents)];
      case "price_desc":
        return [desc(schema.sellerInventory.priceCents)];
      case "best_sellers":
        // Sin datos de ventas publicas, "mas vendidos" se aproxima con el
        // inventario mas movido: lo que menos queda es lo que mas sale.
        return [asc(schema.sellerInventory.stock), desc(schema.sellerInventory.updatedAt)];
      default:
        return [desc(schema.sellerInventory.createdAt)];
    }
  })();

  const rows = await db
    .select({
      inventoryId: schema.sellerInventory.id,
      productId: schema.products.id,
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      description: schema.products.description,
      imageUrl: schema.products.imageUrl,
      gallery: schema.products.gallery,
      material: schema.products.material,
      finish: schema.products.finish,
      categoryId: schema.categories.id,
      categoryName: schema.categories.name,
      categorySlug: schema.categories.slug,
      priceCents: schema.sellerInventory.priceCents,
      stock: schema.sellerInventory.stock,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(and(...conditions))
    .orderBy(...orderBy);

  return rows.map((r) => ({ ...r, status: stockStatus(r.stock, true) }));
}

/** Una pieza concreta de una tienda, buscada por su codigo NICE. */
export async function getStoreProduct(
  sellerId: number,
  niceCode: string
): Promise<StoreProduct | null> {
  const db = await getDb();
  const rows = await db
    .select({
      inventoryId: schema.sellerInventory.id,
      productId: schema.products.id,
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      description: schema.products.description,
      imageUrl: schema.products.imageUrl,
      gallery: schema.products.gallery,
      material: schema.products.material,
      finish: schema.products.finish,
      categoryId: schema.categories.id,
      categoryName: schema.categories.name,
      categorySlug: schema.categories.slug,
      priceCents: schema.sellerInventory.priceCents,
      stock: schema.sellerInventory.stock,
      isVisible: schema.sellerInventory.isVisible,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        eq(schema.products.niceCode, niceCode),
        eq(schema.sellerInventory.isVisible, true)
      )
    )
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  const { isVisible, ...rest } = r;
  return { ...rest, status: stockStatus(r.stock, isVisible) };
}

export interface StoreCategory {
  name: string;
  slug: string;
  count: number;
}

/**
 * Solo las categorias en las que esta tienda tiene algo. Enseñar "Caballero"
 * vacio en la tienda de alguien que solo vende aretes es ruido.
 */
export async function listStoreCategories(sellerId: number): Promise<StoreCategory[]> {
  const db = await getDb();
  return db
    .select({
      name: schema.categories.name,
      slug: schema.categories.slug,
      count: sql<number>`count(*)`,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        eq(schema.sellerInventory.isVisible, true),
        gt(schema.sellerInventory.stock, 0)
      )
    )
    .groupBy(schema.categories.id)
    .orderBy(asc(schema.categories.position), asc(schema.categories.name));
}

/** Los acabados presentes en esta tienda, para el filtro. */
export async function listStoreFinishes(sellerId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ finish: schema.products.finish })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        eq(schema.sellerInventory.isVisible, true)
      )
    );
  return rows.map((r) => r.finish).filter((f): f is string => Boolean(f)).sort();
}

/** Piezas sugeridas debajo del detalle: misma categoria, distinta pieza. */
export async function listRelated(
  sellerId: number,
  categoryId: number | null,
  excludeProductId: number,
  limit = 4
): Promise<StoreProduct[]> {
  if (categoryId === null) return [];
  const all = await listStoreProducts(sellerId, { category: undefined });
  return all.filter((p) => p.categoryId === categoryId && p.productId !== excludeProductId).slice(0, limit);
}
