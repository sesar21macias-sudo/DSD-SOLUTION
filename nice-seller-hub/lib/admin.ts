import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { outer } from "./sql-helpers";

/**
 * Consultas de la plataforma completa. Son las unicas que NO se acotan por
 * `sellerId`, y por eso todas pasan primero por `requireAdmin()`. Ninguna de
 * estas funciones se importa desde el panel de una distribuidora.
 */

export interface PlatformStats {
  sellers: number;
  activeSellers: number;
  customers: number;
  products: number;
  orders: number;
  salesCents: number;
  /** Lo que te pagan al mes las distribuidoras al corriente. */
  mrrCents: number;
  /** Cuántas ya vencieron su fecha de pago. */
  overdueSellers: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const db = await getDb();

  const [sellers] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when status = 'active' then 1 else 0 end)`,
    })
    .from(schema.sellers);

  const [customers] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.customers);

  const [products] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.products);

  const [orders] = await db.select({ total: sql<number>`count(*)` }).from(schema.orders);

  const [sales] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.sales.totalCents}), 0)` })
    .from(schema.sales);

  const today = new Date().toISOString().slice(0, 10);
  const [billing] = await db
    .select({
      mrr: sql<number>`coalesce(sum(case when plan_paid_until >= ${today} then plan_price_cents else 0 end), 0)`,
      overdue: sql<number>`sum(case when plan_paid_until is not null and plan_paid_until < ${today} then 1 else 0 end)`,
    })
    .from(schema.sellers);

  return {
    sellers: sellers?.total ?? 0,
    activeSellers: sellers?.active ?? 0,
    customers: customers?.total ?? 0,
    products: products?.total ?? 0,
    orders: orders?.total ?? 0,
    salesCents: sales?.total ?? 0,
    mrrCents: billing?.mrr ?? 0,
    overdueSellers: billing?.overdue ?? 0,
  };
}

export interface SellerRow {
  id: number;
  /** La cuenta que la administra: es a quien se le genera un enlace nuevo. */
  userId: number;
  whatsapp: string;
  slug: string;
  businessName: string;
  city: string | null;
  status: string;
  createdAt: string;
  products: number;
  customers: number;
  salesCents: number;
  /** Lo que te paga a ti — no lo que ella cobra a sus clientas. */
  planStatus: string;
  planPriceCents: number;
  planPaidUntil: string | null;
}

export async function listSellers(): Promise<SellerRow[]> {
  const db = await getDb();
  return db
    .select({
      id: schema.sellers.id,
      userId: schema.sellers.userId,
      whatsapp: schema.sellers.whatsapp,
      slug: schema.sellers.slug,
      businessName: schema.sellers.businessName,
      city: schema.sellers.city,
      status: schema.sellers.status,
      createdAt: schema.sellers.createdAt,
      planStatus: schema.sellers.planStatus,
      planPriceCents: schema.sellers.planPriceCents,
      planPaidUntil: schema.sellers.planPaidUntil,
      products: sql<number>`(select count(*) from seller_inventory where seller_id = ${outer("sellers", "id")})`.as("products"),
      customers: sql<number>`(select count(*) from seller_customers where seller_id = ${outer("sellers", "id")})`.as("customers"),
      salesCents: sql<number>`(select coalesce(sum(total_cents), 0) from sales where seller_id = ${outer("sellers", "id")})`.as("sales_cents"),
    })
    .from(schema.sellers)
    .orderBy(desc(sql.raw("sales_cents")));
}

export interface ActivityRow {
  kind: string;
  text: string;
  at: string;
}

/**
 * Actividad reciente de toda la plataforma. Se arma con tres consultas cortas
 * y se ordena en memoria: un UNION en SQLite con tres formas distintas de fila
 * seria mas fragil de leer que esto y no mas rapido con estos volumenes.
 */
export async function listActivity(limit = 20): Promise<ActivityRow[]> {
  const db = await getDb();

  const sales = await db
    .select({
      name: schema.sellers.businessName,
      at: schema.sales.createdAt,
      cents: schema.sales.totalCents,
    })
    .from(schema.sales)
    .innerJoin(schema.sellers, eq(schema.sellers.id, schema.sales.sellerId))
    .orderBy(desc(schema.sales.createdAt))
    .limit(limit);

  const orders = await db
    .select({
      name: schema.sellers.businessName,
      at: schema.orders.createdAt,
      number: schema.orders.orderNumber,
    })
    .from(schema.orders)
    .innerJoin(schema.sellers, eq(schema.sellers.id, schema.orders.sellerId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit);

  const movements = await db
    .select({
      name: schema.sellers.businessName,
      at: schema.inventoryMovements.createdAt,
      type: schema.inventoryMovements.type,
      product: schema.products.name,
    })
    .from(schema.inventoryMovements)
    .innerJoin(schema.sellers, eq(schema.sellers.id, schema.inventoryMovements.sellerId))
    .innerJoin(schema.products, eq(schema.products.id, schema.inventoryMovements.productId))
    .orderBy(desc(schema.inventoryMovements.createdAt))
    .limit(limit);

  const rows: ActivityRow[] = [
    ...sales.map((s) => ({
      kind: "sale",
      text: `${s.name} registró una venta`,
      at: s.at,
    })),
    ...orders.map((o) => ({
      kind: "order",
      text: `${o.name} recibió el pedido ${o.number}`,
      at: o.at,
    })),
    ...movements
      .filter((m) => m.type === "add" || m.type === "sale")
      .map((m) => ({
        kind: "inventory",
        text:
          m.type === "add"
            ? `${m.name} agregó ${m.product}`
            : `${m.name} vendió ${m.product}`,
        at: m.at,
      })),
  ];

  return rows.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

export async function setSellerStatus(sellerId: number, status: "active" | "suspended") {
  const db = await getDb();
  await db
    .update(schema.sellers)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(schema.sellers.id, sellerId));
}
