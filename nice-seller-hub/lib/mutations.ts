import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizePhone } from "./phone";
import { awardPointsForSale } from "./loyalty";

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
}

export type RegisterSaleResult =
  | { ok: true; saleId: number; totalCents: number; pointsEarned: number }
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
      subtotalCents: inv.priceCents * line.quantity,
      inventoryId: inv.inventoryId,
      stockBefore: inv.stock,
    });
  }

  const totalCents = items.reduce((s, i) => s + i.subtotalCents, 0);

  let customerId: number | null = null;
  if (input.customerName?.trim() && input.customerPhone?.trim()) {
    const c = await findOrCreateCustomer(sellerId, input.customerName, input.customerPhone);
    if (!c.ok) return { ok: false, error: c.error };
    customerId = c.customerId;
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
      totalCents,
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
      subtotalCents: i.subtotalCents,
    }))
  );

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

  // 4. Puntos.
  let pointsEarned = 0;
  if (customerId !== null) {
    pointsEarned = await awardPointsForSale(sellerId, customerId, saleId, totalCents);
  }

  // 5. Si la venta vino de un pedido, el pedido queda entregado.
  if (input.orderId) {
    await db
      .update(schema.orders)
      .set({ status: "delivered", updatedAt: new Date().toISOString() })
      .where(and(eq(schema.orders.id, input.orderId), eq(schema.orders.sellerId, sellerId)));
  }

  return { ok: true, saleId, totalCents, pointsEarned };
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
  schedule?: string | null;
  deliveryMethods?: string | null;
  paymentMethods?: string | null;
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
      schedule: input.schedule ?? null,
      deliveryMethods: input.deliveryMethods ?? null,
      paymentMethods: input.paymentMethods ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.sellers.id, sellerId));

  return { ok: true };
}
