import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getD1, getDb, schema } from "@/db";
import { dayKey } from "./format";
import { discountFor } from "./loyalty-rules";
import { holdForOrder, reservedByOthersSql } from "./reservations";
import { outer } from "./sql-helpers";
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
  | {
      ok: true;
      orderId: number;
      orderNumber: string;
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
    }
  | { ok: false; problems: OrderProblem[] };

/**
 * El cupon del club que la clienta eligio aplicar, ya validado contra la base.
 * Llega resuelto —nunca como el codigo que escribio el navegador— porque el
 * descuento es dinero y no puede depender de lo que mande el cliente.
 */
export interface OrderCoupon {
  code: string;
  kind: string;
  value: number;
}

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
  customerId: number | null = null,
  coupon: OrderCoupon | null = null,
  /**
   * Quien esta comprando. Sus propias piezas apartadas no le estorban, y al
   * final del proceso esas reservas pasan de "carrito" a "pedido" para que la
   * pieza siga retenida mientras la distribuidora contesta por WhatsApp.
   */
  visitorId: string | null = null
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
      reserved: reservedByOthersSql(
        sellerId,
        outer("seller_inventory", "product_id"),
        visitorId
      ).as("reserved"),
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

    // Lo que de verdad puede llevarse: las piezas que hay menos las que otra
    // persona tiene apartadas en este momento.
    const free = inv ? Math.max(0, inv.stock - (inv.reserved ?? 0)) : 0;

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
    if (free <= 0) {
      problems.push({
        niceCode: line.niceCode,
        name: inv.name,
        available: 0,
        requested: line.quantity,
        // Se distingue agotada de apartada: son dos cosas distintas para quien
        // la queria, y decir "se agotó" cuando volverá en diez minutos es una
        // venta que se pierde por escribir mal un mensaje.
        message:
          inv.stock > 0
            ? `${inv.name} la está comprando alguien más en este momento.`
            : `${inv.name} se agotó.`,
      });
      continue;
    }
    if (line.quantity > free) {
      problems.push({
        niceCode: line.niceCode,
        name: inv.name,
        available: free,
        requested: line.quantity,
        message:
          free === 1
            ? `Solo queda 1 pieza libre de ${inv.name}.`
            : `Solo hay ${free} piezas libres de ${inv.name}.`,
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

  const subtotalCents = items.reduce((sum, i) => sum + i.subtotalCents, 0);

  // El descuento se calcula aqui, sobre los precios que acaba de leer la base.
  // Si se confiara en un monto mandado por el navegador, cualquiera podria
  // pedirse un descuento del tamaño que quisiera.
  const discountCents = coupon
    ? discountFor(coupon.kind, coupon.value, subtotalCents)
    : 0;
  const totalCents = subtotalCents - discountCents;

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
      subtotalCents,
      discountCents,
      redemptionCode: coupon?.code ?? null,
      totalCents,
    })
    .returning({ id: schema.orders.id });

  const orderId = inserted[0].id;
  await db.insert(schema.orderItems).values(items.map((i) => ({ ...i, orderId })));

  /**
   * Las piezas quedan retenidas a nombre de este pedido.
   *
   * Aqui esta el hueco que el apartado de carrito no cubria: entre que alguien
   * manda su pedido por WhatsApp y la distribuidora contesta pueden pasar
   * horas, y en ese rato otra clienta puede pedir la misma ultima pieza. Un
   * apartado de quince minutos no alcanza para eso; el del pedido dura un dia.
   */
  if (visitorId) {
    await holdForOrder(
      sellerId,
      visitorId,
      orderId,
      items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
    );
  }

  return { ok: true, orderId, orderNumber, subtotalCents, discountCents, totalCents };
}

export interface OrderDetail {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  contactName: string | null;
  contactPhone: string | null;
  note: string | null;
  subtotalCents: number;
  discountCents: number;
  redemptionCode: string | null;
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
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    redemptionCode: order.redemptionCode,
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
