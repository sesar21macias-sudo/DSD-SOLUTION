import "server-only";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizePhone } from "./phone";
import {
  awardPointsForSale,
  discountFor,
  findAvailableRedemption,
  getAccount,
  getProgram,
  markRedemptionUsed,
  spendPointsAsCash,
} from "./loyalty";
import { MAX_DISCOUNT_PCT, costFromCatalog } from "./costing";
import { releaseOrderHolds } from "./reservations";
import { TEMPLATE_MAX_LENGTH } from "./message-templates";

/**
 * Escrituras del panel. Igual que las lecturas, **todas** llevan `sellerId` en
 * el WHERE. Una escritura sin acotar seria peor que una lectura sin acotar:
 * dejaria a alguien modificando el inventario de otra persona.
 *
 * Nota sobre transacciones: D1 no expone transacciones interactivas dentro de
 * un Worker. Donde importa (registrar una venta) el orden de las escrituras
 * esta pensado para que una falla a medio camino deje datos incompletos pero
 * nunca contradictorios: primero el descuento de stock —lo que no se puede
 * duplicar— y despues el registro, que en el peor caso se vuelve a capturar.
 */

// --- Inventario ------------------------------------------------------------

export interface AddToInventoryInput {
  productId: number;
  priceCents: number;
  /** Lo que le costo. Null = no se sabe, y asi se reporta. */
  costCents?: number | null;
  stock: number;
}

export async function addToInventory(
  sellerId: number,
  input: AddToInventoryInput
): Promise<{ ok: true; inventoryId: number } | { ok: false; error: string }> {
  const db = await getDb();

  const existing = await db
    .select({ id: schema.sellerInventory.id })
    .from(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        eq(schema.sellerInventory.productId, input.productId)
      )
    )
    .limit(1);

  if (existing[0]) {
    return { ok: false, error: "Ya tienes esta pieza en tu inventario. Edítala desde la lista." };
  }

  const inserted = await db
    .insert(schema.sellerInventory)
    .values({
      sellerId,
      productId: input.productId,
      priceCents: input.priceCents,
      costCents: input.costCents ?? null,
      stock: input.stock,
      isVisible: true,
    })
    .returning({ id: schema.sellerInventory.id });

  await db.insert(schema.inventoryMovements).values({
    sellerId,
    productId: input.productId,
    type: "add",
    delta: input.stock,
    stockBefore: 0,
    stockAfter: input.stock,
    reason: "Alta en inventario",
  });

  return { ok: true, inventoryId: inserted[0].id };
}

export interface UpdateInventoryInput {
  priceCents?: number;
  costCents?: number | null;
  stock?: number;
  isVisible?: boolean;
  reason?: string;
}

export async function updateInventory(
  sellerId: number,
  inventoryId: number,
  input: UpdateInventoryInput
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.id, inventoryId),
        eq(schema.sellerInventory.sellerId, sellerId)
      )
    )
    .limit(1);

  const current = rows[0];
  if (!current) return { ok: false, error: "Esa pieza no está en tu inventario." };

  const next = {
    priceCents: input.priceCents ?? current.priceCents,
    // `undefined` deja el costo como esta; `null` lo borra a proposito.
    costCents: input.costCents === undefined ? current.costCents : input.costCents,
    stock: input.stock ?? current.stock,
    isVisible: input.isVisible ?? current.isVisible,
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(schema.sellerInventory)
    .set(next)
    .where(
      and(
        eq(schema.sellerInventory.id, inventoryId),
        eq(schema.sellerInventory.sellerId, sellerId)
      )
    );

  // El historial solo registra lo que de verdad cambio.
  if (next.stock !== current.stock) {
    await db.insert(schema.inventoryMovements).values({
      sellerId,
      productId: current.productId,
      type: next.stock > current.stock ? "increase" : "decrease",
      delta: next.stock - current.stock,
      stockBefore: current.stock,
      stockAfter: next.stock,
      reason: input.reason ?? "Ajuste manual",
    });
  }
  if (next.isVisible !== current.isVisible) {
    await db.insert(schema.inventoryMovements).values({
      sellerId,
      productId: current.productId,
      type: next.isVisible ? "show" : "hide",
      delta: 0,
      stockBefore: current.stock,
      stockAfter: next.stock,
      reason: next.isVisible ? "Publicada en la tienda" : "Oculta de la tienda",
    });
  }

  return { ok: true };
}

export async function removeFromInventory(
  sellerId: number,
  inventoryId: number
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.id, inventoryId),
        eq(schema.sellerInventory.sellerId, sellerId)
      )
    )
    .limit(1);

  const current = rows[0];
  if (!current) return { ok: false, error: "Esa pieza no está en tu inventario." };

  await db
    .delete(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.id, inventoryId),
        eq(schema.sellerInventory.sellerId, sellerId)
      )
    );

  await db.insert(schema.inventoryMovements).values({
    sellerId,
    productId: current.productId,
    type: "remove",
    delta: -current.stock,
    stockBefore: current.stock,
    stockAfter: 0,
    reason: "Eliminada del inventario",
  });

  return { ok: true };
}

// --- Productos del catalogo ------------------------------------------------

export interface UpsertProductInput {
  niceCode: string;
  name: string;
  description?: string | null;
  categoryId?: number | null;
  material?: string | null;
  finish?: string | null;
  imageUrl?: string | null;
}

/**
 * Busca la pieza por su codigo NICE y la reutiliza si ya existe. Que dos
 * distribuidoras den de alta el 826031 no puede crear dos productos distintos:
 * el codigo NICE es la identidad de la pieza en todo el sistema.
 */
export async function findOrCreateProduct(
  sellerId: number,
  input: UpsertProductInput
): Promise<{ id: number; created: boolean }> {
  const db = await getDb();
  const code = input.niceCode.trim();

  const existing = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.niceCode, code))
    .limit(1);

  if (existing[0]) return { id: existing[0].id, created: false };

  const inserted = await db
    .insert(schema.products)
    .values({
      niceCode: code,
      name: input.name.trim(),
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      material: input.material ?? null,
      finish: input.finish ?? null,
      imageUrl: input.imageUrl ?? null,
      createdBySellerId: sellerId,
    })
    .returning({ id: schema.products.id });

  return { id: inserted[0].id, created: true };
}

/**
 * Pone o cambia la foto de una pieza del catálogo global.
 *
 * La foto es del código NICE, no de la distribuidora que la trae: si ella
 * sube la foto real de una pieza que NICE ya no tiene en su tienda en línea
 * (o que el catálogo trajo sin foto), la ven todas las que después reciban
 * el mismo código — es la misma pieza para todas.
 *
 * Cualquier distribuidora con esa pieza en su inventario puede ponerle foto:
 * no hace falta que sea quien la dio de alta primero.
 */
export async function updateProductImage(
  sellerId: number,
  productId: number,
  imageUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();

  // Confirma que la pieza este de verdad en el inventario de esta
  // distribuidora antes de tocar un dato que comparten todas.
  const owns = await db
    .select({ id: schema.sellerInventory.id })
    .from(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.productId, productId),
        eq(schema.sellerInventory.sellerId, sellerId)
      )
    )
    .limit(1);

  if (!owns[0]) return { ok: false, error: "Esa pieza no está en tu inventario." };

  await db
    .update(schema.products)
    .set({ imageUrl: imageUrl.trim() || null })
    .where(eq(schema.products.id, productId));

  return { ok: true };
}

// --- Clientes --------------------------------------------------------------

/**
 * Encuentra o crea al cliente por telefono y lo liga a esta tienda. El
 * telefono se normaliza antes de buscar: si no, "656 123 4567" y
 * "+52 656 123 4567" serian dos personas distintas.
 */
export async function findOrCreateCustomer(
  sellerId: number,
  name: string,
  phone: string,
  email?: string | null
): Promise<{ ok: true; customerId: number } | { ok: false; error: string }> {
  const normalized = normalizePhone(phone);
  if (!normalized.ok) return { ok: false, error: normalized.error ?? "Teléfono inválido." };

  const db = await getDb();

  await db
    .insert(schema.customers)
    .values({ name: name.trim(), phone: normalized.value, email: email ?? null })
    .onConflictDoNothing();

  const rows = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(eq(schema.customers.phone, normalized.value))
    .limit(1);

  const customerId = rows[0]?.id;
  if (!customerId) return { ok: false, error: "No pudimos guardar al cliente." };

  await db
    .insert(schema.sellerCustomers)
    .values({ sellerId, customerId })
    .onConflictDoNothing();

  return { ok: true, customerId };
}

// --- Pedidos -----------------------------------------------------------------

export interface OrderLine {
  inventoryId: number;
  quantity: number;
}

/**
 * Cambia las piezas de un pedido antes de convertirlo en venta.
 *
 * Un pedido no mueve inventario —es una intencion, no un compromiso—, asi que
 * editarlo no toca existencias ni apartados: solo corrige lo que va a ver la
 * distribuidora cuando lo confirme o registre la venta. Si el pedido traia un
 * cupon vigente, el descuento se vuelve a calcular sobre el nuevo subtotal.
 *
 * Un pedido ya entregado o cancelado no se toca: ese ya se cerro.
 */
export async function updateOrderItems(
  sellerId: number,
  orderId: number,
  lines: OrderLine[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();

  const orderRows = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.sellerId, sellerId)))
    .limit(1);

  const order = orderRows[0];
  if (!order) return { ok: false, error: "Ese pedido no es tuyo." };
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, error: "Ese pedido ya se cerró y no se puede editar." };
  }

  const cleanLines = lines
    .map((l) => ({ inventoryId: Number(l.inventoryId), quantity: Math.floor(Number(l.quantity)) }))
    .filter((l) => l.inventoryId > 0 && l.quantity > 0);

  if (cleanLines.length === 0) return { ok: false, error: "El pedido necesita al menos una pieza." };

  const inv = await db
    .select({
      inventoryId: schema.sellerInventory.id,
      productId: schema.products.id,
      name: schema.products.name,
      code: schema.products.niceCode,
      priceCents: schema.sellerInventory.priceCents,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(eq(schema.sellerInventory.sellerId, sellerId));

  const byId = new Map(inv.map((i) => [i.inventoryId, i]));

  const items: {
    productId: number;
    nameSnapshot: string;
    codeSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }[] = [];

  for (const line of cleanLines) {
    const item = byId.get(line.inventoryId);
    if (!item) continue; // Pieza que ya no esta en su inventario: se omite sola.
    const quantity = Math.min(line.quantity, 99);
    items.push({
      productId: item.productId,
      nameSnapshot: item.name,
      codeSnapshot: item.code,
      quantity,
      unitPriceCents: item.priceCents,
      subtotalCents: item.priceCents * quantity,
    });
  }

  if (items.length === 0) return { ok: false, error: "Ninguna de esas piezas sigue en tu inventario." };

  const subtotalCents = items.reduce((s, i) => s + i.subtotalCents, 0);

  let discountCents = 0;
  if (order.redemptionCode) {
    const redemption = await findAvailableRedemption(sellerId, order.redemptionCode);
    if (redemption) discountCents = discountFor(redemption.kind, redemption.value, subtotalCents);
  }

  const totalCents = subtotalCents - discountCents;

  await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  await db.insert(schema.orderItems).values(items.map((i) => ({ orderId, ...i })));

  await db
    .update(schema.orders)
    .set({ subtotalCents, discountCents, totalCents, updatedAt: new Date().toISOString() })
    .where(eq(schema.orders.id, orderId));

  return { ok: true };
}

// --- Ventas ----------------------------------------------------------------

export interface SaleLine {
  inventoryId: number;
  quantity: number;
}

export interface RegisterSaleInput {
  lines: SaleLine[];
  paymentMethod: string;
  customerName?: string | null;
  customerPhone?: string | null;
  orderId?: number | null;
  note?: string | null;
  /**
   * Lo que paga en este momento. `null` significa que paga todo —que es el
   * caso normal— y evita tener que mandar el total desde el navegador, donde
   * podria venir mal.
   */
  paidCents?: number | null;
  /** Fecha limite acordada, solo para ventas a abonos. */
  dueDate?: string | null;
  /**
   * Puntos que quiere usar como pago, al tipo de cambio del club
   * (`centsPerPoint`). Solo aplica en pago completo: en abonos no hay un
   * total final todavia contra que descontarlos.
   */
  usePoints?: number | null;
  /** Un descuento a mano, en centavos — precio de amiga, pieza con detalle, etc. */
  manualDiscountCents?: number | null;
}

export type RegisterSaleResult =
  | {
      ok: true;
      saleId: number;
      totalCents: number;
      discountCents: number;
      paidCents: number;
      balanceCents: number;
      pointsEarned: number;
      pointsSpent: number;
    }
  | { ok: false; error: string };

/**
 * Registra una venta fisica. Este es el unico camino por el que baja el stock.
 *
 * El descuento se hace con `stock = stock - n WHERE stock >= n`: si entre la
 * lectura y la escritura alguien mas vendio la misma pieza, el UPDATE no
 * afecta ninguna fila y la venta se rechaza, en vez de dejar el inventario en
 * negativo.
 */
export async function registerSale(
  sellerId: number,
  input: RegisterSaleInput
): Promise<RegisterSaleResult> {
  const db = await getDb();

  const lines = input.lines
    .map((l) => ({ inventoryId: Number(l.inventoryId), quantity: Math.floor(Number(l.quantity)) }))
    .filter((l) => l.inventoryId > 0 && l.quantity > 0);

  if (lines.length === 0) return { ok: false, error: "Agrega al menos una pieza a la venta." };

  const rows = await db
    .select({
      inventoryId: schema.sellerInventory.id,
      productId: schema.products.id,
      name: schema.products.name,
      niceCode: schema.products.niceCode,
      priceCents: schema.sellerInventory.priceCents,
      costCents: schema.sellerInventory.costCents,
      stock: schema.sellerInventory.stock,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(eq(schema.sellerInventory.sellerId, sellerId));

  const byId = new Map(rows.map((r) => [r.inventoryId, r]));

  const items: {
    productId: number;
    nameSnapshot: string;
    codeSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    unitCostCents: number | null;
    subtotalCents: number;
    inventoryId: number;
    stockBefore: number;
  }[] = [];

  for (const line of lines) {
    const inv = byId.get(line.inventoryId);
    // Si el id no esta en el mapa, o no es de esta tienda, o no alcanza:
    // la venta completa se rechaza. No se registran ventas parciales.
    if (!inv) return { ok: false, error: "Una de las piezas no está en tu inventario." };
    if (inv.stock < line.quantity) {
      return {
        ok: false,
        error:
          inv.stock === 0
            ? `${inv.name} está agotado.`
            : `Solo tienes ${inv.stock} de ${inv.name}.`,
      };
    }
    items.push({
      productId: inv.productId,
      nameSnapshot: inv.name,
      codeSnapshot: inv.niceCode,
      quantity: line.quantity,
      unitPriceCents: inv.priceCents,
      unitCostCents: inv.costCents,
      subtotalCents: inv.priceCents * line.quantity,
      inventoryId: inv.inventoryId,
      stockBefore: inv.stock,
    });
  }

  const subtotalCents = items.reduce((s, i) => s + i.subtotalCents, 0);

  /**
   * Si la venta viene de un pedido que traia cupon, el descuento se aplica
   * aqui tambien.
   *
   * Sin esto la venta cobraria el precio de lista y los puntos se calcularian
   * sobre un dinero que nadie pago: la clienta ya vio su total con descuento
   * en WhatsApp, y ese es el que vale. El valor del cupon sale de la base, no
   * del pedido, para que un pedido viejo no pueda arrastrar un descuento que
   * ya se uso.
   */
  let couponDiscountCents = 0;
  let redemptionCode: string | null = null;

  if (input.orderId) {
    const orderRows = await db
      .select({ redemptionCode: schema.orders.redemptionCode })
      .from(schema.orders)
      .where(and(eq(schema.orders.id, input.orderId), eq(schema.orders.sellerId, sellerId)))
      .limit(1);

    const code = orderRows[0]?.redemptionCode;
    if (code) {
      const redemption = await findAvailableRedemption(sellerId, code);
      if (redemption) {
        couponDiscountCents = discountFor(redemption.kind, redemption.value, subtotalCents);
        redemptionCode = redemption.code;
      }
    }
  }

  // El cliente se resuelve antes del total porque usar puntos como pago
  // depende de saber a quien pertenecen — y de paso queda listo para
  // acumular los que gane esta misma compra.
  let customerId: number | null = null;
  if (input.customerName?.trim() && input.customerPhone?.trim()) {
    const c = await findOrCreateCustomer(sellerId, input.customerName, input.customerPhone);
    if (!c.ok) return { ok: false, error: c.error };
    customerId = c.customerId;
  }

  /**
   * Puntos usados como pago, al tipo de cambio del club — solo en pago
   * completo: en abonos no hay un total final todavia contra que
   * descontarlos, y ademas se puede cancelar antes de terminar de pagar.
   *
   * El saldo se vuelve a leer y a topar aqui, en el servidor: lo que la
   * pantalla mostraba pudo quedar viejo mientras ella armaba la venta.
   */
  const isFullPayment = input.paidCents === undefined || input.paidCents === null;

  // Un descuento a mano — precio de amiga, pieza con un detalle, lo que sea.
  // Se topa contra lo que queda despues del cupon: nunca deja el total en
  // negativo, sin importar lo que alguien haya escrito.
  const manualDiscountCents = Math.max(
    0,
    Math.min(
      Math.floor(Number(input.manualDiscountCents ?? 0)),
      Math.max(0, subtotalCents - couponDiscountCents)
    )
  );

  const requestedPoints = Math.floor(Number(input.usePoints ?? 0));
  let usedPoints = 0;
  let pointsDiscountCents = 0;

  if (isFullPayment && requestedPoints > 0 && customerId !== null) {
    const program = await getProgram(sellerId);
    if (program.enabled) {
      const account = await getAccount(sellerId, customerId);
      const remainingAfterCoupon = Math.max(0, subtotalCents - couponDiscountCents - manualDiscountCents);
      const maxByBalance = Math.min(requestedPoints, account.points);
      const maxByTotal = Math.floor(remainingAfterCoupon / Math.max(1, program.centsPerPoint));
      usedPoints = Math.max(0, Math.min(maxByBalance, maxByTotal));
      pointsDiscountCents = usedPoints * program.centsPerPoint;
    }
  }

  const discountCents = couponDiscountCents + manualDiscountCents + pointsDiscountCents;
  const totalCents = subtotalCents - discountCents;

  /**
   * Cuanto queda pagado hoy.
   *
   * Una venta a abonos SI descuenta el inventario: la pieza ya se aparto y
   * nadie mas se la puede llevar. Lo que queda abierto es el cobro, no la
   * mercancia — y por eso el saldo vive en la venta y no en un apartado
   * separado que habria que reconciliar despues.
   */
  const requestedPaid = input.paidCents;
  const paidCents =
    requestedPaid === undefined || requestedPaid === null
      ? totalCents
      : Math.min(totalCents, Math.max(0, Math.round(requestedPaid)));
  const status = paidCents >= totalCents ? "paid" : "partial";

  // Una venta a abonos sin cliente identificado no se puede cobrar despues:
  // no habria a quien buscar ni a que telefono escribirle.
  if (status === "partial" && customerId === null) {
    return {
      ok: false,
      error: "Para una venta a abonos necesitamos el nombre y el teléfono de tu clienta.",
    };
  }

  // 1. Descontar. Es lo unico que no se puede repetir sin hacer daño.
  for (const item of items) {
    const res = await db
      .update(schema.sellerInventory)
      .set({
        stock: sql`${schema.sellerInventory.stock} - ${item.quantity}`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.sellerInventory.id, item.inventoryId),
          eq(schema.sellerInventory.sellerId, sellerId),
          sql`${schema.sellerInventory.stock} >= ${item.quantity}`
        )
      )
      .returning({ id: schema.sellerInventory.id });

    if (res.length === 0) {
      return {
        ok: false,
        error: `El inventario de ${item.nameSnapshot} cambió mientras registrabas. Vuelve a intentarlo.`,
      };
    }
  }

  // 2. Registrar la venta.
  const inserted = await db
    .insert(schema.sales)
    .values({
      sellerId,
      customerId,
      orderId: input.orderId ?? null,
      discountCents,
      redemptionCode,
      totalCents,
      paidCents,
      status,
      dueDate: status === "partial" ? (input.dueDate ?? null) : null,
      paymentMethod: input.paymentMethod,
      note: input.note ?? null,
    })
    .returning({ id: schema.sales.id });

  const saleId = inserted[0].id;

  await db.insert(schema.saleItems).values(
    items.map((i) => ({
      saleId,
      productId: i.productId,
      nameSnapshot: i.nameSnapshot,
      codeSnapshot: i.codeSnapshot,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      unitCostCents: i.unitCostCents,
      subtotalCents: i.subtotalCents,
    }))
  );

  // 2b. El pago inicial queda escrito como abono, tambien cuando paga todo.
  // Asi el detalle de una venta siempre cuadra con la suma de sus abonos, sin
  // un caso especial para "el primero no cuenta".
  if (paidCents > 0) {
    await db.insert(schema.salePayments).values({
      sellerId,
      saleId,
      amountCents: paidCents,
      method: input.paymentMethod,
      note: status === "partial" ? "Anticipo" : null,
    });
  }

  // 3. Historial de inventario.
  await db.insert(schema.inventoryMovements).values(
    items.map((i) => ({
      sellerId,
      productId: i.productId,
      type: "sale",
      delta: -i.quantity,
      stockBefore: i.stockBefore,
      stockAfter: i.stockBefore - i.quantity,
      reason: "Venta",
      referenceId: saleId,
    }))
  );

  /**
   * 4. Puntos — solo cuando la venta queda pagada.
   *
   * En una venta a abonos llegan al liquidar, no al apartar. Darlos por
   * adelantado dejaria canjear una recompensa con el dinero de una compra que
   * todavia no se termina de pagar —o que se cancela—, y quitarlos despues
   * seria peor que no haberlos dado.
   */
  let pointsEarned = 0;
  let pointsSpent = 0;
  if (customerId !== null && status === "paid") {
    // El descuento ya se calculo arriba; aqui se descuenta de verdad, con el
    // mismo candado de `redeemReward` contra usarlo dos veces.
    if (usedPoints > 0) {
      const spent = await spendPointsAsCash(sellerId, customerId, usedPoints, saleId);
      if (spent.ok) pointsSpent = usedPoints;
    }

    pointsEarned = await awardPointsForSale(sellerId, customerId, saleId, totalCents);
    if (pointsEarned > 0) {
      await db
        .update(schema.sales)
        .set({ pointsAwarded: pointsEarned })
        .where(eq(schema.sales.id, saleId));
    }
  }

  // 5. Si la venta vino de un pedido, el pedido queda entregado.
  if (input.orderId) {
    // Si el pedido no traia nombre o telefono —no todas las clientas los
    // dejan al pedir por WhatsApp— y aqui si se capturaron, se guardan
    // tambien en el pedido: sin esto, uno que ella completaba a mano en la
    // venta se quedaba "Cliente sin nombre" en la lista de Pedidos para
    // siempre, aunque la venta ya tuviera a quien pertenecia.
    const contactUpdate: { contactName?: string; contactPhone?: string } = {};
    if (input.customerName?.trim()) contactUpdate.contactName = input.customerName.trim();
    if (input.customerPhone?.trim()) {
      const normalized = normalizePhone(input.customerPhone);
      if (normalized.ok) contactUpdate.contactPhone = normalized.value;
    }

    await db
      .update(schema.orders)
      .set({ status: "delivered", updatedAt: new Date().toISOString(), ...contactUpdate })
      .where(and(eq(schema.orders.id, input.orderId), eq(schema.orders.sellerId, sellerId)));

    // Y se sueltan sus reservas: el stock ya bajo de verdad, y seguir
    // reteniendo las piezas seria descontarlas dos veces.
    await releaseOrderHolds(input.orderId);
  }

  // 6. El cupon se quema aqui y no al generar el pedido: un pedido es una
  // intencion, y quemarlo ahi dejaria sin cupon a quien nunca llego a comprar.
  // Cuando la venta existe, el descuento ya se dio.
  if (redemptionCode) {
    const redemption = await findAvailableRedemption(sellerId, redemptionCode);
    if (redemption) await markRedemptionUsed(sellerId, redemption.id, input.orderId ?? null);
  }

  return {
    ok: true,
    saleId,
    totalCents,
    discountCents,
    paidCents,
    balanceCents: totalCents - paidCents,
    pointsEarned,
    pointsSpent,
  };
}

// --- Abonos ----------------------------------------------------------------

export type PaymentResult =
  | { ok: true; paidCents: number; balanceCents: number; settled: boolean; pointsEarned: number }
  | { ok: false; error: string };

/**
 * Registra un abono.
 *
 * El acumulado sube sobre la propia fila y el saldo siempre se deriva de ahi;
 * no existe un campo "saldo" que alguien pueda dejar desfasado del detalle de
 * abonos. Una clienta que pregunta cuanto lleva merece una respuesta que se
 * pueda demostrar renglon por renglon.
 *
 * Cuando el abono liquida la venta, esa misma llamada otorga los puntos.
 */
export async function addSalePayment(
  sellerId: number,
  saleId: number,
  amountCents: number,
  method: string,
  note?: string | null
): Promise<PaymentResult> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.sellerId, sellerId)))
    .limit(1);

  const sale = rows[0];
  if (!sale) return { ok: false, error: "Esa venta no existe." };
  if (sale.status === "cancelled") return { ok: false, error: "Esa venta está cancelada." };

  const balance = sale.totalCents - sale.paidCents;
  if (balance <= 0) return { ok: false, error: "Esta venta ya está pagada." };

  const amount = Math.round(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Escribe cuánto está abonando." };
  }

  // Un abono mayor al saldo casi siempre es un dedazo. Se acepta pero se topa
  // al saldo: dejar escrito que cobro de mas seria peor que corregirlo.
  const applied = Math.min(amount, balance);

  const nextPaid = sale.paidCents + applied;
  const settled = nextPaid >= sale.totalCents;

  await db.insert(schema.salePayments).values({
    sellerId,
    saleId,
    amountCents: applied,
    method,
    note: note?.trim().slice(0, 200) || null,
  });

  await db
    .update(schema.sales)
    .set({ paidCents: nextPaid, status: settled ? "paid" : "partial" })
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.sellerId, sellerId)));

  let pointsEarned = 0;
  if (settled && sale.customerId !== null && sale.pointsAwarded === 0) {
    // Solo quien gane este UPDATE otorga los puntos. Sin esta marca, dos
    // abonos que liquiden casi al mismo tiempo los darian dos veces.
    const claimed = await db
      .update(schema.sales)
      .set({ pointsAwarded: -1 })
      .where(and(eq(schema.sales.id, saleId), eq(schema.sales.pointsAwarded, 0)))
      .returning({ id: schema.sales.id });

    if (claimed.length > 0) {
      pointsEarned = await awardPointsForSale(
        sellerId,
        sale.customerId,
        saleId,
        sale.totalCents
      );
      await db
        .update(schema.sales)
        .set({ pointsAwarded: pointsEarned })
        .where(eq(schema.sales.id, saleId));
    }
  }

  return {
    ok: true,
    paidCents: nextPaid,
    balanceCents: sale.totalCents - nextPaid,
    settled,
    pointsEarned,
  };
}

/**
 * Cancela una venta y devuelve las piezas al inventario.
 *
 * Existe sobre todo por los apartados: alguien aparta, deja un anticipo y no
 * vuelve. Sin esto la pieza quedaria fuera del inventario para siempre y la
 * tienda estaria mintiendo sobre lo que tiene.
 *
 * Los abonos NO se borran: quedan como constancia de que ese dinero entro. Que
 * se hace con el —devolverlo, dejarlo a cuenta— es una conversacion entre ella
 * y su clienta, no algo que este sistema deba decidir por su cuenta.
 */
export async function cancelSale(
  sellerId: number,
  saleId: number,
  reason?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.sellerId, sellerId)))
    .limit(1);

  const sale = rows[0];
  if (!sale) return { ok: false, error: "Esa venta no existe." };
  if (sale.status === "cancelled") return { ok: false, error: "Esa venta ya está cancelada." };

  const items = await db
    .select()
    .from(schema.saleItems)
    .where(eq(schema.saleItems.saleId, saleId));

  for (const item of items) {
    const inv = await db
      .select({ id: schema.sellerInventory.id, stock: schema.sellerInventory.stock })
      .from(schema.sellerInventory)
      .where(
        and(
          eq(schema.sellerInventory.sellerId, sellerId),
          eq(schema.sellerInventory.productId, item.productId)
        )
      )
      .limit(1);

    // Si la pieza ya se elimino del inventario no se recrea sola: seria
    // resucitar algo que ella decidio quitar.
    const line = inv[0];
    if (!line) continue;

    await db
      .update(schema.sellerInventory)
      .set({
        stock: sql`${schema.sellerInventory.stock} + ${item.quantity}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.sellerInventory.id, line.id));

    await db.insert(schema.inventoryMovements).values({
      sellerId,
      productId: item.productId,
      type: "increase",
      delta: item.quantity,
      stockBefore: line.stock,
      stockAfter: line.stock + item.quantity,
      reason: reason?.trim().slice(0, 120) || "Venta cancelada",
      referenceId: saleId,
    });
  }

  await db
    .update(schema.sales)
    .set({ status: "cancelled" })
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.sellerId, sellerId)));

  /**
   * Puntos: deshacer tanto lo que ganó como lo que gastó en ella.
   *
   * Antes esto no pasaba — cancelar una venta pagada dejaba a la clienta con
   * puntos de una compra que ya no existe, o sin los que uso como pago en una
   * venta que ya no se cobro. Se revierte aparte de `movePoints`: lo ganado
   * tambien tiene que bajar del acumulado historico —la venta nunca paso—,
   * cosa que `movePoints` deliberadamente no hace al restar puntos; y lo
   * gastado se devuelve sin tocar el acumulado, porque nunca se le quito de
   * ahi al gastarlo.
   */
  if (sale.customerId) {
    const account = await getAccount(sellerId, sale.customerId);

    if (account.id !== 0 && sale.pointsAwarded > 0) {
      await db
        .update(schema.loyaltyAccounts)
        .set({
          points: sql`max(0, ${schema.loyaltyAccounts.points} - ${sale.pointsAwarded})`,
          lifetimePoints: sql`max(0, ${schema.loyaltyAccounts.lifetimePoints} - ${sale.pointsAwarded})`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.loyaltyAccounts.id, account.id));

      await db.insert(schema.loyaltyTransactions).values({
        accountId: account.id,
        type: "adjust",
        points: -sale.pointsAwarded,
        description: "Venta cancelada",
        referenceId: saleId,
      });
    }

    if (account.id !== 0) {
      const spentRows = await db
        .select({ points: schema.loyaltyTransactions.points })
        .from(schema.loyaltyTransactions)
        .where(
          and(
            eq(schema.loyaltyTransactions.accountId, account.id),
            eq(schema.loyaltyTransactions.type, "spend"),
            eq(schema.loyaltyTransactions.referenceId, saleId)
          )
        );
      // Los puntos gastados se guardan en negativo; sumarlos da lo que se usó.
      const spent = -spentRows.reduce((s, r) => s + r.points, 0);

      if (spent > 0) {
        await db
          .update(schema.loyaltyAccounts)
          .set({
            points: sql`${schema.loyaltyAccounts.points} + ${spent}`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.loyaltyAccounts.id, account.id));

        await db.insert(schema.loyaltyTransactions).values({
          accountId: account.id,
          type: "adjust",
          points: spent,
          description: "Venta cancelada — puntos devueltos",
          referenceId: saleId,
        });
      }
    }
  }

  return { ok: true };
}

/**
 * Calcula el costo de las piezas que no lo tienen, con el descuento de la
 * distribuidora.
 *
 * Existe por un hueco real: quien carga su inventario y **despues** escribe su
 * descuento se queda con todo sin costear, y la unica salida era abrir pieza
 * por pieza y tocar "Usar". Con cincuenta piezas eso no lo hace nadie, y sin
 * costos no hay ganancia que calcular — que es justo lo que esta funcion
 * existe para responder.
 *
 * Solo toca lo que esta vacio. Un costo que ella ya capturo es un dato suyo, y
 * pisarlo con una estimacion seria cambiarle los numeros sin avisar.
 */
export async function fillMissingCosts(
  sellerId: number
): Promise<{ ok: true; filled: number } | { ok: false; error: string }> {
  const db = await getDb();

  const sellerRows = await db
    .select({ discountPct: schema.sellers.distributorDiscountPct })
    .from(schema.sellers)
    .where(eq(schema.sellers.id, sellerId))
    .limit(1);

  const discountPct = sellerRows[0]?.discountPct ?? 0;
  if (discountPct <= 0) {
    return {
      ok: false,
      error: "Primero escribe tu descuento de distribuidora en Configuración.",
    };
  }

  // Solo las que tienen precio de catalogo: sin ese numero no hay de donde
  // sacar el costo, y inventarlo desde su propio precio de venta diria que
  // gana cero.
  const pending = await db
    .select({
      inventoryId: schema.sellerInventory.id,
      catalogCents: schema.products.suggestedPriceCents,
    })
    .from(schema.sellerInventory)
    .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
    .where(
      and(
        eq(schema.sellerInventory.sellerId, sellerId),
        isNull(schema.sellerInventory.costCents),
        isNotNull(schema.products.suggestedPriceCents)
      )
    );

  if (pending.length === 0) return { ok: true, filled: 0 };

  const nowIso = new Date().toISOString();
  let filled = 0;

  for (const row of pending) {
    const cost = costFromCatalog(row.catalogCents ?? 0, discountPct);
    if (cost <= 0) continue;

    await db
      .update(schema.sellerInventory)
      .set({ costCents: cost, updatedAt: nowIso })
      .where(
        and(
          eq(schema.sellerInventory.id, row.inventoryId),
          eq(schema.sellerInventory.sellerId, sellerId)
        )
      );
    filled++;
  }

  return { ok: true, filled };
}

// --- Perfil ----------------------------------------------------------------

export interface SellerProfileInput {
  businessName: string;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  whatsapp: string;
  instagram?: string | null;
  facebook?: string | null;
  profileImage?: string | null;
  coverImage?: string | null;
  tagline?: string | null;
  schedule?: string | null;
  deliveryMethods?: string | null;
  paymentMethods?: string | null;
  /** Su descuento de distribuidora, en porcentaje entero. */
  distributorDiscountPct?: number;
}

export async function updateSellerProfile(
  sellerId: number,
  input: SellerProfileInput
): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizePhone(input.whatsapp);
  if (!phone.ok) return { ok: false, error: phone.error ?? "WhatsApp inválido." };

  const db = await getDb();
  await db
    .update(schema.sellers)
    .set({
      businessName: input.businessName.trim(),
      description: input.description ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      whatsapp: phone.value,
      instagram: input.instagram ?? null,
      facebook: input.facebook ?? null,
      profileImage: input.profileImage ?? null,
      coverImage: input.coverImage ?? null,
      tagline: input.tagline ?? null,
      schedule: input.schedule ?? null,
      deliveryMethods: input.deliveryMethods ?? null,
      paymentMethods: input.paymentMethods ?? null,
      distributorDiscountPct: Math.min(
        MAX_DISCOUNT_PCT,
        Math.max(0, Math.round(input.distributorDiscountPct ?? 0))
      ),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.sellers.id, sellerId));

  return { ok: true };
}

// --- Mensajes de WhatsApp ---------------------------------------------------

export interface MessageTemplatesInput {
  orderGreeting: string;
  orderClosing: string;
  shareMessage: string;
  paymentReminder: string;
  couponMessage: string;
  pointsGreeting: string;
  pointsClosing: string;
}

/**
 * Guarda su version de cada mensaje.
 *
 * Un campo vacio se guarda como nulo, no como cadena vacia: nulo significa
 * "usa el de siempre", y una cadena vacia mandaria un mensaje de WhatsApp en
 * blanco. Es la misma regla que ya usan las condiciones del club.
 */
export async function updateMessageTemplates(
  sellerId: number,
  input: MessageTemplatesInput
): Promise<void> {
  const db = await getDb();
  const clean = (v: string) => v.trim().slice(0, TEMPLATE_MAX_LENGTH) || null;

  await db
    .update(schema.sellers)
    .set({
      orderGreetingTemplate: clean(input.orderGreeting),
      orderClosingTemplate: clean(input.orderClosing),
      shareMessageTemplate: clean(input.shareMessage),
      paymentReminderTemplate: clean(input.paymentReminder),
      couponMessageTemplate: clean(input.couponMessage),
      pointsGreetingTemplate: clean(input.pointsGreeting),
      pointsClosingTemplate: clean(input.pointsClosing),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.sellers.id, sellerId));
}
