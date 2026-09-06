import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getD1, getDb, schema } from "@/db";
import { dayKey } from "./format";
import type { OrderStatus } from "./order-status";

export * from "./order-status";

/**
 * Un pedido es una intencion de compra que todavia se tiene que confirmar por
 * WhatsApp. NO mueve existencias: si lo hiciera, cualquiera podria dejar en
 * ceros el inventario de una distribuidora sin comprarle nada. El stock baja
 * cuando ella registra la venta.
 */

/**
 * Folio NICE-YYYYMMDD-NNNN.
 *
 * El contador se incrementa con un UPSERT ... RETURNING, que SQLite resuelve
 * en una sola sentencia atomica. Un `SELECT count(*) + 1` daria el mismo folio
 * a dos clientes que confirmen en el mismo segundo, y el folio es lo unico que
 * liga la conversacion de WhatsApp con el pedido en el panel.
 */
export async function nextOrderNumber(): Promise<string> {
  const day = dayKey(new Date().toISOString()).replace(/-/g, "");
  const db = await getD1();

  const row = await db
    .prepare(
      `INSERT INTO order_counters (day, last_seq) VALUES (?, 1)
       ON CONFLICT(day) DO UPDATE SET last_seq = last_seq + 1
       RETURNING last_seq`
    )
    .bind(day)
    .first<{ last_seq: number }>();

  const seq = row?.last_seq ?? 1;
  return `NICE-${day}-${String(seq).padStart(4, "0")}`;
}

export interface CartLine {
  niceCode: string;
  quantity: number;
}

export interface OrderProblem {
  niceCode: string;
  name: string;
  /** Lo que hay ahora mismo. 0 = ya no esta. */
  available: number;
  requested: number;
  message: string;
}

export type CreateOrderResult =
  | { ok: true; orderId: number; orderNumber: string; totalCents: number }
  | { ok: false; problems: OrderProblem[] };

export interface OrderContact {
  name?: string | null;
  phone?: string | null;
  note?: string | null;
}

/**
 * Crea el pedido despues de revisar el inventario **en el servidor**.
 *
 * El carrito vive en el navegador y puede llevar horas abierto; entre que
 * alguien agrego la ultima pulsera y presiono el boton, la distribuidora pudo
 * haberla vendido en persona. Esta es la unica revision que cuenta: la del
 * carrito solo evita el viaje.
 */
export async function createOrder(
  sellerId: number,
  lines: CartLine[],
  contact: OrderContact = {},
  customerId: number | null = null
): Promise<CreateOrderResult> {
  const db = await getDb();

  const clean = lines
    .map((l) => ({ niceCode: String(l.niceCode), quantity: Math.floor(Number(l.quantity)) }))
    .filter((l) => l.niceCode && l.quantity > 0);

  if (clean.length === 0) return { ok: false, problems: [] };

  const rows = await db
    .select({
      productId: schema.products.id,
      niceCode: schema.products.niceCode,
      name: schema.products.name,
      priceCents: schema.sellerInventory.priceCents,
      stock: schema.sellerInventory.stock,
      isVisible: schema.sellerInventory.isVisible,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        inArray(
          schema.products.niceCode,
          clean.map((l) => l.niceCode)
        )
      )
    );

  const byCode = new Map(rows.map((r) => [r.niceCode, r]));
  const problems: OrderProblem[] = [];
  const items: {
    productId: number;
    nameSnapshot: string;
    codeSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }[] = [];

  for (const line of clean) {
    const inv = byCode.get(line.niceCode);

    if (!inv || !inv.isVisible) {
      problems.push({
        niceCode: line.niceCode,
        name: inv?.name ?? line.niceCode,
        available: 0,
        requested: line.quantity,
        message: "Esta pieza ya no está disponible en esta tienda.",
      });
      continue;
    }
    if (inv.stock <= 0) {
      problems.push({
        niceCode: line.niceCode,
        name: inv.name,
        available: 0,
        requested: line.quantity,
        message: `${inv.name} se agotó.`,
      });
      continue;
    }
    if (line.quantity > inv.stock) {
      problems.push({
        niceCode: line.niceCode,
        name: inv.name,
        available: inv.stock,
        requested: line.quantity,
        message:
          inv.stock === 1
            ? `Solo queda 1 pieza de ${inv.name}.`
            : `Solo hay ${inv.stock} piezas de ${inv.name}.`,
      });
      continue;
    }

    items.push({
      productId: inv.productId,
      nameSnapshot: inv.name,
      codeSnapshot: inv.niceCode,
      quantity: line.quantity,
      unitPriceCents: inv.priceCents,
      subtotalCents: inv.priceCents * line.quantity,
    });
  }

  if (problems.length > 0) return { ok: false, problems };

  const totalCents = items.reduce((sum, i) => sum + i.subtotalCents, 0);
  const orderNumber = await nextOrderNumber();

  const inserted = await db
    .insert(schema.orders)
    .values({
      sellerId,
      customerId,
      orderNumber,
      status: "pending",
      contactName: contact.name ?? null,
      contactPhone: contact.phone ?? null,
      note: contact.note ?? null,
      subtotalCents: totalCents,
      totalCents,
    })
    .returning({ id: schema.orders.id });

  const orderId = inserted[0].id;
  await db.insert(schema.orderItems).values(items.map((i) => ({ ...i, orderId })));

  return { ok: true, orderId, orderNumber, totalCents };
}

export interface OrderDetail {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  contactName: string | null;
  contactPhone: string | null;
  note: string | null;
  totalCents: number;
  createdAt: string;
  sellerId: number;
  items: {
    name: string;
    code: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }[];
}

/**
 * Un pedido por su folio, acotado a la tienda que lo genero. El folio va en la
 * URL de la pagina de confirmacion, asi que la consulta pide slug + folio:
 * adivinar folios de otra tienda no sirve de nada.
 */
export async function getOrderByNumber(
  sellerId: number,
  orderNumber: string
): Promise<OrderDetail | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.sellerId, sellerId), eq(schema.orders.orderNumber, orderNumber)))
    .limit(1);

  const order = rows[0];
  if (!order) return null;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    note: order.note,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    sellerId: order.sellerId,
    items: items.map((i) => ({
      name: i.nameSnapshot,
      code: i.codeSnapshot,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      subtotalCents: i.subtotalCents,
    })),
  };
}

/** Marca que el cliente si abrio WhatsApp. Solo avanza desde "pending". */
export async function markWhatsAppSent(orderId: number): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.orders)
    .set({ status: "whatsapp_sent", updatedAt: new Date().toISOString() })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")));
}
