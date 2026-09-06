import "server-only";

import { and, asc, desc, eq, gt, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayKey, addDays } from "./format";
import { outer } from "./sql-helpers";
import { LOW_STOCK_THRESHOLD, stockStatus, type StockStatus } from "./inventory";

/**
 * Consultas del panel. **Regla sin excepciones: todas reciben `sellerId` como
 * primer parametro y lo meten en el WHERE.** Ese `sellerId` sale siempre de
 * `requireSeller()`, nunca del cliente. Es la unica defensa real contra que
 * una distribuidora vea el negocio de otra, y no hay ninguna consulta aqui que
 * se salte la regla.
 */

// --- Inventario ------------------------------------------------------------

export interface InventoryItem {
  inventoryId: number;
  productId: number;
  niceCode: string;
  name: string;
  imageUrl: string | null;
  categoryName: string | null;
  priceCents: number;
  stock: number;
  isVisible: boolean;
  status: StockStatus;
  updatedAt: string;
}

export async function listInventory(
  sellerId: number,
  q?: string
): Promise<InventoryItem[]> {
  const db = await getDb();

  const conditions = [eq(schema.sellerInventory.sellerId, sellerId)];
  if (q?.trim()) {
    const needle = `%${q.trim().toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${schema.products.name})`, needle),
        like(sql`lower(${schema.products.niceCode})`, needle)
      )!
    );
  }

  const rows = await db
    .select({
      inventoryId: schema.sellerInventory.id,
      productId: schema.products.id,
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      imageUrl: schema.products.imageUrl,
      categoryName: schema.categories.name,
      priceCents: schema.sellerInventory.priceCents,
      stock: schema.sellerInventory.stock,
      isVisible: schema.sellerInventory.isVisible,
      updatedAt: schema.sellerInventory.updatedAt,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(and(...conditions))
    .orderBy(asc(schema.sellerInventory.stock), asc(schema.products.name));

  return rows.map((r) => ({ ...r, status: stockStatus(r.stock, r.isVisible) }));
}

/**
 * Una linea del inventario por su id, verificando que sea de esta tienda.
 * Devolver null en vez de lanzar deja que la pagina responda "no existe" sin
 * revelar que el registro existe pero es de alguien mas.
 */
export async function getInventoryItem(sellerId: number, inventoryId: number) {
  const db = await getDb();
  const rows = await db
    .select({
      inventoryId: schema.sellerInventory.id,
      productId: schema.products.id,
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      description: schema.products.description,
      imageUrl: schema.products.imageUrl,
      material: schema.products.material,
      finish: schema.products.finish,
      categoryId: schema.products.categoryId,
      priceCents: schema.sellerInventory.priceCents,
      stock: schema.sellerInventory.stock,
      isVisible: schema.sellerInventory.isVisible,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(
      and(
        eq(schema.sellerInventory.id, inventoryId),
        eq(schema.sellerInventory.sellerId, sellerId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface MovementRow {
  id: number;
  type: string;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string | null;
  createdAt: string;
  productName: string;
  niceCode: string;
}

export async function listMovements(sellerId: number, limit = 40): Promise<MovementRow[]> {
  const db = await getDb();
  return db
    .select({
      id: schema.inventoryMovements.id,
      type: schema.inventoryMovements.type,
      delta: schema.inventoryMovements.delta,
      stockBefore: schema.inventoryMovements.stockBefore,
      stockAfter: schema.inventoryMovements.stockAfter,
      reason: schema.inventoryMovements.reason,
      createdAt: schema.inventoryMovements.createdAt,
      productName: schema.products.name,
      niceCode: schema.products.niceCode,
    })
    .from(schema.inventoryMovements)
    .innerJoin(schema.products, eq(schema.products.id, schema.inventoryMovements.productId))
    .where(eq(schema.inventoryMovements.sellerId, sellerId))
    .orderBy(desc(schema.inventoryMovements.createdAt))
    .limit(limit);
}

// --- Panel principal -------------------------------------------------------

export interface DashboardStats {
  revenueCents: number;
  unitsSold: number;
  customers: number;
  inventoryCount: number;
  ordersPending: number;
  lowStock: { name: string; niceCode: string; stock: number }[];
  soldOut: number;
}

export async function getDashboardStats(
  sellerId: number,
  sinceDayKey: string
): Promise<DashboardStats> {
  const db = await getDb();

  const [revenue] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.sales.totalCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.sales)
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey)));

  const [units] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.saleItems.quantity}), 0)` })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey)));

  const [customers] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.sellerCustomers)
    .where(eq(schema.sellerCustomers.sellerId, sellerId));

  const [inventory] = await db
    .select({
      lines: sql<number>`count(*)`,
      pieces: sql<number>`coalesce(sum(${schema.sellerInventory.stock}), 0)`,
      soldOut: sql<number>`sum(case when ${schema.sellerInventory.stock} <= 0 then 1 else 0 end)`,
    })
    .from(schema.sellerInventory)
    .where(eq(schema.sellerInventory.sellerId, sellerId));

  const [pending] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.sellerId, sellerId),
        inArray(schema.orders.status, ["pending", "whatsapp_sent", "confirmed", "preparing"])
      )
    );

  const lowStock = await db
    .select({
      name: schema.products.name,
      niceCode: schema.products.niceCode,
      stock: schema.sellerInventory.stock,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        gt(schema.sellerInventory.stock, 0),
        lte(schema.sellerInventory.stock, LOW_STOCK_THRESHOLD)
      )
    )
    .orderBy(asc(schema.sellerInventory.stock))
    .limit(5);

  return {
    revenueCents: revenue?.total ?? 0,
    unitsSold: units?.total ?? 0,
    customers: customers?.total ?? 0,
    inventoryCount: inventory?.pieces ?? 0,
    ordersPending: pending?.total ?? 0,
    lowStock,
    soldOut: inventory?.soldOut ?? 0,
  };
}

export interface DailyRevenue {
  day: string;
  cents: number;
}

/**
 * Ingresos por dia. Se agrupa con `substr(created_at, 1, 10)` porque las
 * fechas se guardan como ISO en UTC; para Ciudad Juarez eso corre el corte
 * unas horas, cosa que no cambia la lectura de una grafica de tendencia.
 */
export async function getDailyRevenue(
  sellerId: number,
  sinceDayKey: string
): Promise<DailyRevenue[]> {
  const db = await getDb();
  const rows = await db
    .select({
      day: sql<string>`substr(${schema.sales.createdAt}, 1, 10)`,
      cents: sql<number>`coalesce(sum(${schema.sales.totalCents}), 0)`,
    })
    .from(schema.sales)
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey)))
    .groupBy(sql`substr(${schema.sales.createdAt}, 1, 10)`)
    .orderBy(sql`substr(${schema.sales.createdAt}, 1, 10)`);
  return rows;
}

export interface TopProduct {
  name: string;
  niceCode: string;
  quantity: number;
  cents: number;
}

export async function getTopProducts(
  sellerId: number,
  sinceDayKey: string,
  limit = 5
): Promise<TopProduct[]> {
  const db = await getDb();
  return db
    .select({
      name: schema.saleItems.nameSnapshot,
      niceCode: schema.saleItems.codeSnapshot,
      quantity: sql<number>`sum(${schema.saleItems.quantity})`,
      cents: sql<number>`sum(${schema.saleItems.subtotalCents})`,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey)))
    .groupBy(schema.saleItems.codeSnapshot)
    .orderBy(desc(sql`sum(${schema.saleItems.quantity})`))
    .limit(limit);
}

export interface CategorySlice {
  name: string;
  quantity: number;
  cents: number;
}

export async function getCategoryBreakdown(
  sellerId: number,
  sinceDayKey: string
): Promise<CategorySlice[]> {
  const db = await getDb();
  return db
    .select({
      name: sql<string>`coalesce(${schema.categories.name}, 'Sin categoría')`,
      quantity: sql<number>`sum(${schema.saleItems.quantity})`,
      cents: sql<number>`sum(${schema.saleItems.subtotalCents})`,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .leftJoin(schema.products, eq(schema.products.id, schema.saleItems.productId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey)))
    .groupBy(sql`coalesce(${schema.categories.name}, 'Sin categoría')`)
    .orderBy(desc(sql`sum(${schema.saleItems.subtotalCents})`));
}

// --- Pedidos ---------------------------------------------------------------

export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: string;
  contactName: string | null;
  contactPhone: string | null;
  totalCents: number;
  createdAt: string;
  itemCount: number;
}

export async function listOrders(sellerId: number, status?: string): Promise<OrderSummary[]> {
  const db = await getDb();
  const conditions = [eq(schema.orders.sellerId, sellerId)];
  if (status) conditions.push(eq(schema.orders.status, status));

  return db
    .select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      status: schema.orders.status,
      contactName: schema.orders.contactName,
      contactPhone: schema.orders.contactPhone,
      totalCents: schema.orders.totalCents,
      createdAt: schema.orders.createdAt,
      itemCount: sql<number>`(select coalesce(sum(quantity), 0) from order_items where order_id = ${outer("orders", "id")})`.as("item_count"),
    })
    .from(schema.orders)
    .where(and(...conditions))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);
}

// --- Ventas ----------------------------------------------------------------

export interface SaleSummary {
  id: number;
  totalCents: number;
  paymentMethod: string;
  createdAt: string;
  customerName: string | null;
  itemCount: number;
}

export async function listSales(sellerId: number, limit = 60): Promise<SaleSummary[]> {
  const db = await getDb();
  return db
    .select({
      id: schema.sales.id,
      totalCents: schema.sales.totalCents,
      paymentMethod: schema.sales.paymentMethod,
      createdAt: schema.sales.createdAt,
      customerName: schema.customers.name,
      itemCount: sql<number>`(select coalesce(sum(quantity), 0) from sale_items where sale_id = ${outer("sales", "id")})`.as("item_count"),
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.sales.customerId))
    .where(eq(schema.sales.sellerId, sellerId))
    .orderBy(desc(schema.sales.createdAt))
    .limit(limit);
}

// --- Clientes --------------------------------------------------------------

export interface CustomerSummary {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  purchases: number;
  spentCents: number;
  points: number;
  lastPurchase: string | null;
}

/**
 * La cartera de esta tienda. `seller_customers` es lo que hace que la consulta
 * no pueda devolver a un cliente de otra distribuidora: los totales se calculan
 * solo sobre las ventas de este `sellerId`.
 */
export async function listCustomers(sellerId: number, q?: string): Promise<CustomerSummary[]> {
  const db = await getDb();

  const conditions = [eq(schema.sellerCustomers.sellerId, sellerId)];
  if (q?.trim()) {
    const needle = `%${q.trim().toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${schema.customers.name})`, needle),
        like(schema.customers.phone, needle)
      )!
    );
  }

  return db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      phone: schema.customers.phone,
      email: schema.customers.email,
      purchases: sql<number>`(select count(*) from sales where seller_id = ${sellerId} and customer_id = ${outer("customers", "id")})`.as("purchases"),
      spentCents: sql<number>`(select coalesce(sum(total_cents), 0) from sales where seller_id = ${sellerId} and customer_id = ${outer("customers", "id")})`.as("spent_cents"),
      points: sql<number>`coalesce(${schema.loyaltyAccounts.points}, 0)`.as("points"),
      lastPurchase: sql<string | null>`(select max(created_at) from sales where seller_id = ${sellerId} and customer_id = ${outer("customers", "id")})`.as("last_purchase"),
    })
    .from(schema.sellerCustomers)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.sellerCustomers.customerId))
    .leftJoin(
      schema.loyaltyAccounts,
      and(
        eq(schema.loyaltyAccounts.customerId, schema.customers.id),
        eq(schema.loyaltyAccounts.sellerId, sellerId)
      )
    )
    .where(and(...conditions))
    .orderBy(desc(sql.raw("spent_cents")));
}

/** Un cliente, solo si le compra a esta tienda. */
export async function getCustomer(sellerId: number, customerId: number) {
  const all = await listCustomers(sellerId);
  return all.find((c) => c.id === customerId) ?? null;
}

export async function listCustomerSales(sellerId: number, customerId: number) {
  const db = await getDb();
  return db
    .select({
      id: schema.sales.id,
      totalCents: schema.sales.totalCents,
      paymentMethod: schema.sales.paymentMethod,
      createdAt: schema.sales.createdAt,
    })
    .from(schema.sales)
    .where(and(eq(schema.sales.sellerId, sellerId), eq(schema.sales.customerId, customerId)))
    .orderBy(desc(schema.sales.createdAt))
    .limit(30);
}

// --- Rangos de fecha para los filtros --------------------------------------

export const RANGES = [
  { id: "today", label: "Hoy", days: 0 },
  { id: "7d", label: "7 días", days: 7 },
  { id: "30d", label: "30 días", days: 30 },
  { id: "90d", label: "90 días", days: 90 },
  { id: "365d", label: "Este año", days: 365 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

/** El ISO desde el que filtrar. Los ISO se comparan como texto y ordenan bien. */
export function rangeStart(range: string): string {
  const found = RANGES.find((r) => r.id === range) ?? RANGES[2];
  const today = dayKey(new Date().toISOString());
  return `${addDays(today, -found.days)}T00:00:00.000Z`;
}
