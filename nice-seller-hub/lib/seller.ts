import "server-only";

import { and, asc, desc, eq, gt, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayKey, addDays } from "./format";
import { outer } from "./sql-helpers";
import { LOW_STOCK_THRESHOLD, stockStatus, type StockStatus } from "./inventory";
import { countActiveHolds } from "./reservations";

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
  /** Piezas que alguien esta comprando en este momento. */
  reserved: number;
  /** Null cuando la pieza se cargo antes de que hubiera costos. */
  costCents: number | null;
  /** El precio de lista de NICE, para comparar. */
  catalogPriceCents: number | null;
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
      costCents: schema.sellerInventory.costCents,
      catalogPriceCents: schema.products.suggestedPriceCents,
      stock: schema.sellerInventory.stock,
      isVisible: schema.sellerInventory.isVisible,
      updatedAt: schema.sellerInventory.updatedAt,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(and(...conditions))
    .orderBy(asc(schema.sellerInventory.stock), asc(schema.products.name));

  /**
   * Lo apartado va aparte y no descuenta el stock: para ella el inventario son
   * las piezas que tiene en su casa, y ver ese numero bajar porque alguien
   * dejo un carrito abierto seria mentirle sobre su propia mercancia.
   */
  const holds = await countActiveHolds(sellerId);

  return rows.map((r) => ({
    ...r,
    reserved: holds.get(r.productId) ?? 0,
    status: stockStatus(r.stock, r.isVisible),
  }));
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
      costCents: schema.sellerInventory.costCents,
      catalogPriceCents: schema.products.suggestedPriceCents,
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

/**
 * Cuanto vale lo que tiene guardado, visto de tres maneras.
 *
 * Las piezas sin costo se cuentan aparte en vez de asumirles cero: un cero
 * diria que le salieron gratis e inflaria la ganancia. La pantalla avisa
 * cuantas faltan por costear en lugar de dar un numero bonito y falso.
 */
export interface InventoryValuation {
  /** Piezas fisicas (suma de existencias). */
  pieces: number;
  /** Renglones distintos del inventario. */
  lines: number;
  /** Renglones que si tienen costo capturado. */
  linesWithCost: number;
  piecesWithCost: number;
  /** Lo invertido, solo sobre las piezas con costo. */
  costCents: number;
  /** Lo mismo valuado a precio de catalogo NICE. */
  catalogCents: number;
  /** Valuado a lo que ella cobra. */
  retailCents: number;
  /**
   * Lo mismo, pero solo de las piezas que si tienen costo.
   *
   * Es el divisor correcto del margen: dividir la ganancia —que solo sale de
   * lo costeado— entre el valor de TODO el inventario da un margen mucho mas
   * bajo del real, porque el denominador incluye piezas que no aportan nada al
   * numerador.
   */
  retailWithCostCents: number;
  /** Lo que ganaria si vendiera todo lo que tiene costeado. */
  projectedProfitCents: number;
}

export async function getInventoryValuation(sellerId: number): Promise<InventoryValuation> {
  const db = await getDb();

  const [row] = await db
    .select({
      pieces: sql<number>`coalesce(sum(${schema.sellerInventory.stock}), 0)`,
      lines: sql<number>`count(*)`,
      linesWithCost: sql<number>`sum(case when ${schema.sellerInventory.costCents} is not null then 1 else 0 end)`,
      piecesWithCost: sql<number>`coalesce(sum(case when ${schema.sellerInventory.costCents} is not null then ${schema.sellerInventory.stock} else 0 end), 0)`,
      costCents: sql<number>`coalesce(sum(coalesce(${schema.sellerInventory.costCents}, 0) * ${schema.sellerInventory.stock}), 0)`,
      catalogCents: sql<number>`coalesce(sum(coalesce(${schema.products.suggestedPriceCents}, ${schema.sellerInventory.priceCents}) * ${schema.sellerInventory.stock}), 0)`,
      retailCents: sql<number>`coalesce(sum(${schema.sellerInventory.priceCents} * ${schema.sellerInventory.stock}), 0)`,
      retailWithCostCents: sql<number>`coalesce(sum(case when ${schema.sellerInventory.costCents} is not null then ${schema.sellerInventory.priceCents} * ${schema.sellerInventory.stock} else 0 end), 0)`,
      // La ganancia proyectada solo cuenta lo costeado: mezclar piezas sin
      // costo la haria ver mas grande de lo que es.
      projectedProfitCents: sql<number>`coalesce(sum(case when ${schema.sellerInventory.costCents} is not null then (${schema.sellerInventory.priceCents} - ${schema.sellerInventory.costCents}) * ${schema.sellerInventory.stock} else 0 end), 0)`,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(eq(schema.sellerInventory.sellerId, sellerId));

  return {
    pieces: row?.pieces ?? 0,
    lines: row?.lines ?? 0,
    linesWithCost: row?.linesWithCost ?? 0,
    piecesWithCost: row?.piecesWithCost ?? 0,
    costCents: row?.costCents ?? 0,
    catalogCents: row?.catalogCents ?? 0,
    retailCents: row?.retailCents ?? 0,
    retailWithCostCents: row?.retailWithCostCents ?? 0,
    projectedProfitCents: row?.projectedProfitCents ?? 0,
  };
}

/**
 * La ganancia de verdad de un periodo: lo vendido menos lo que costo.
 *
 * Se calcula sobre `sale_items.unit_cost_cents`, la copia del costo al momento
 * de vender. Las ventas canceladas quedan fuera; las de abonos si cuentan —la
 * mercancia ya salio y la ganancia esta comprometida, aunque falte cobrarla.
 */
export interface ProfitStats {
  revenueCents: number;
  costCents: number;
  profitCents: number;
  /** Piezas vendidas con costo conocido y sin el. */
  unitsWithCost: number;
  unitsWithoutCost: number;
}

export async function getProfitStats(
  sellerId: number,
  sinceDayKey: string
): Promise<ProfitStats> {
  const db = await getDb();

  const [row] = await db
    .select({
      revenueCents: sql<number>`coalesce(sum(case when ${schema.saleItems.unitCostCents} is not null then ${schema.saleItems.subtotalCents} else 0 end), 0)`,
      costCents: sql<number>`coalesce(sum(coalesce(${schema.saleItems.unitCostCents}, 0) * ${schema.saleItems.quantity}), 0)`,
      unitsWithCost: sql<number>`coalesce(sum(case when ${schema.saleItems.unitCostCents} is not null then ${schema.saleItems.quantity} else 0 end), 0)`,
      unitsWithoutCost: sql<number>`coalesce(sum(case when ${schema.saleItems.unitCostCents} is null then ${schema.saleItems.quantity} else 0 end), 0)`,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .where(
      and(
        eq(schema.sales.sellerId, sellerId),
        gte(schema.sales.createdAt, sinceDayKey),
        sql`${schema.sales.status} != 'cancelled'`
      )
    );

  const revenueCents = row?.revenueCents ?? 0;
  const costCents = row?.costCents ?? 0;

  return {
    revenueCents,
    costCents,
    profitCents: revenueCents - costCents,
    unitsWithCost: row?.unitsWithCost ?? 0,
    unitsWithoutCost: row?.unitsWithoutCost ?? 0,
  };
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

  // Una venta cancelada devuelve las piezas al inventario: seguir contandola
  // aqui inflaria "Ingresos" y "Piezas vendidas" con dinero que nunca se cobro
  // y piezas que nunca salieron de verdad. La seccion de ganancia ya excluia
  // las canceladas; estas dos tarjetas se habian quedado sin ese filtro.
  const [revenue] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.sales.totalCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.sales)
    .where(
      and(
        eq(schema.sales.sellerId, sellerId),
        gte(schema.sales.createdAt, sinceDayKey),
        ne(schema.sales.status, "cancelled")
      )
    );

  const [units] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.saleItems.quantity}), 0)` })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .where(
      and(
        eq(schema.sales.sellerId, sellerId),
        gte(schema.sales.createdAt, sinceDayKey),
        ne(schema.sales.status, "cancelled")
      )
    );

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
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey), ne(schema.sales.status, "cancelled")))
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
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey), ne(schema.sales.status, "cancelled")))
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
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, sinceDayKey), ne(schema.sales.status, "cancelled")))
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
  discountCents: number;
  paidCents: number;
  /** Lo que falta por cobrar. 0 en una venta de contado. */
  balanceCents: number;
  status: string;
  dueDate: string | null;
  paymentMethod: string;
  createdAt: string;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  itemCount: number;
}

export async function listSales(sellerId: number, limit = 100): Promise<SaleSummary[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.sales.id,
      totalCents: schema.sales.totalCents,
      discountCents: schema.sales.discountCents,
      paidCents: schema.sales.paidCents,
      status: schema.sales.status,
      dueDate: schema.sales.dueDate,
      paymentMethod: schema.sales.paymentMethod,
      createdAt: schema.sales.createdAt,
      customerId: schema.sales.customerId,
      customerName: schema.customers.name,
      customerPhone: schema.customers.phone,
      itemCount: sql<number>`(select coalesce(sum(quantity), 0) from sale_items where sale_id = ${outer("sales", "id")})`.as("item_count"),
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.sales.customerId))
    .where(eq(schema.sales.sellerId, sellerId))
    .orderBy(desc(schema.sales.createdAt))
    .limit(limit);

  // El saldo se deriva, nunca se guarda: un acumulado que se actualiza a mano
  // acaba desfasado del detalle de abonos justo el dia que alguien reclama.
  return rows.map((r) => ({
    ...r,
    balanceCents: r.status === "cancelled" ? 0 : Math.max(0, r.totalCents - r.paidCents),
  }));
}

/** Una venta con su detalle y sus abonos, acotada a esta tienda. */
export async function getSale(sellerId: number, saleId: number) {
  const db = await getDb();

  const rows = await db
    .select({
      sale: schema.sales,
      customerName: schema.customers.name,
      customerPhone: schema.customers.phone,
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.sales.customerId))
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.sellerId, sellerId)))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const [items, payments] = await Promise.all([
    db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, saleId)),
    db
      .select()
      .from(schema.salePayments)
      .where(eq(schema.salePayments.saleId, saleId))
      .orderBy(asc(schema.salePayments.createdAt)),
  ]);

  const sale = found.sale;
  return {
    ...sale,
    customerName: found.customerName,
    customerPhone: found.customerPhone,
    balanceCents: sale.status === "cancelled" ? 0 : Math.max(0, sale.totalCents - sale.paidCents),
    items,
    payments,
  };
}

/** Lo que le deben, en total y por cliente. Es la pantalla de cobranza. */
export interface Receivables {
  totalCents: number;
  count: number;
  overdue: number;
}

export async function getReceivables(sellerId: number): Promise<Receivables> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);

  const [row] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${schema.sales.totalCents} - ${schema.sales.paidCents}), 0)`,
      count: sql<number>`count(*)`,
      overdue: sql<number>`coalesce(sum(case when ${schema.sales.dueDate} is not null and ${schema.sales.dueDate} < ${today} then 1 else 0 end), 0)`,
    })
    .from(schema.sales)
    .where(and(eq(schema.sales.sellerId, sellerId), eq(schema.sales.status, "partial")));

  return {
    totalCents: row?.totalCents ?? 0,
    count: row?.count ?? 0,
    overdue: row?.overdue ?? 0,
  };
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
  /** Acumulado historico: es lo que define el nivel. */
  lifetimePoints: number;
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
      lifetimePoints: sql<number>`coalesce(${schema.loyaltyAccounts.lifetimePoints}, 0)`.as("lifetime_points"),
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

/**
 * `sentence` es la misma ventana de tiempo, pero como se diria dentro de una
 * frase ("Tu negocio hoy", "Ganancia real · en lo que va del año"). No es
 * `label` en minusculas: "Hoy" y "Este año" no aguantan un "ultimos" delante
 * ("ultimos hoy" no se dice), asi que cada rango trae su propio conector.
 */
export const RANGES = [
  { id: "today", label: "Hoy", sentence: "hoy", days: 0 },
  { id: "7d", label: "7 días", sentence: "en los últimos 7 días", days: 7 },
  { id: "30d", label: "30 días", sentence: "en los últimos 30 días", days: 30 },
  { id: "90d", label: "90 días", sentence: "en los últimos 90 días", days: 90 },
  { id: "365d", label: "Este año", sentence: "en lo que va del año", days: 365 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

/** El ISO desde el que filtrar. Los ISO se comparan como texto y ordenan bien. */
export function rangeStart(range: string): string {
  const found = RANGES.find((r) => r.id === range) ?? RANGES[2];
  const today = dayKey(new Date().toISOString());
  return `${addDays(today, -found.days)}T00:00:00.000Z`;
}
