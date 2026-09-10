"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import {
  addSalePayment,
  addToInventory,
  cancelSale,
  fillMissingCosts,
  findOrCreateProduct,
  registerSale,
  removeFromInventory,
  updateInventory,
  updateMessageTemplates,
  updateProductImage,
  updateSellerProfile,
} from "@/lib/mutations";
import { formatMoney, pesosToCents } from "@/lib/format";
import { NICE_CODE_RE_LOOSE, normalizeNiceCode } from "@/lib/nice-code";
import { isOrderStatus } from "@/lib/orders";
import { releaseOrderHolds } from "@/lib/reservations";

/**
 * Acciones de servidor del panel.
 *
 * Todas empiezan igual: `const { seller } = await requireSeller()`. Ese
 * `seller.id` es el unico que llega a la base. Los formularios mandan ids de
 * inventario, de pedido o de cliente, pero cada uno se verifica contra ese
 * `sellerId` antes de tocar nada: un id ajeno no encuentra fila y la accion
 * responde "no es tuyo" en vez de modificar el negocio de otra persona.
 */

export type ActionState = { ok: boolean; error?: string; message?: string };

const OK: ActionState = { ok: true };

// --- Inventario ------------------------------------------------------------

export async function saveInventoryItem(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const inventoryId = Number(form.get("inventoryId"));
  if (!Number.isFinite(inventoryId) || inventoryId <= 0) {
    return { ok: false, error: "No encontramos esa pieza." };
  }

  const priceCents = pesosToCents(String(form.get("price") ?? ""));
  if (priceCents === null || priceCents <= 0) {
    return { ok: false, error: "Escribe un precio válido." };
  }

  const stock = Math.floor(Number(form.get("stock")));
  if (!Number.isFinite(stock) || stock < 0 || stock > 9999) {
    return { ok: false, error: "El stock tiene que ser un número entre 0 y 9999." };
  }

  // Vacio significa "no lo se" y se guarda como nulo, no como cero: un cero
  // diria que la pieza le salio gratis e inflaria toda la ganancia.
  const rawCost = String(form.get("cost") ?? "").trim();
  const costCents = rawCost ? pesosToCents(rawCost) : null;

  const res = await updateInventory(seller.id, inventoryId, {
    priceCents,
    costCents,
    stock,
    isVisible: form.get("isVisible") === "on",
    reason: String(form.get("reason") ?? "") || undefined,
  });

  if (!res.ok) return { ok: false, error: res.error };

  // La foto es del código NICE en el catálogo global, no de esta fila de
  // inventario — por eso se guarda aparte, contra `productId` y no contra
  // `inventoryId`.
  const productId = Number(form.get("productId"));
  if (Number.isFinite(productId) && productId > 0 && form.has("imageUrl")) {
    const imgRes = await updateProductImage(seller.id, productId, String(form.get("imageUrl") ?? ""));
    if (!imgRes.ok) return { ok: false, error: imgRes.error };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/${seller.slug}`);
  return { ok: true, message: "Guardado" };
}

/** Cambio rapido de existencias desde la lista, sin abrir el formulario. */
export async function adjustStock(inventoryId: number, delta: number): Promise<ActionState> {
  const { seller } = await requireSeller();

  const db = await getDb();
  const rows = await db
    .select({ stock: schema.sellerInventory.stock })
    .from(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.id, inventoryId),
        eq(schema.sellerInventory.sellerId, seller.id)
      )
    )
    .limit(1);

  if (!rows[0]) return { ok: false, error: "No encontramos esa pieza." };

  const next = Math.max(0, rows[0].stock + delta);
  const res = await updateInventory(seller.id, inventoryId, {
    stock: next,
    reason: "Ajuste rápido",
  });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/${seller.slug}`);
  return OK;
}

export async function toggleVisibility(
  inventoryId: number,
  isVisible: boolean
): Promise<ActionState> {
  const { seller } = await requireSeller();
  const res = await updateInventory(seller.id, inventoryId, { isVisible });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/${seller.slug}`);
  return OK;
}

export async function deleteInventoryItem(inventoryId: number): Promise<ActionState> {
  const { seller } = await requireSeller();
  const res = await removeFromInventory(seller.id, inventoryId);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/${seller.slug}`);
  return OK;
}

export async function createInventoryItem(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const niceCode = String(form.get("niceCode") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  if (!NICE_CODE_RE_LOOSE.test(niceCode)) {
    return {
      ok: false,
      // La diagonal se nombra porque es la de la talla de los anillos, y sin
      // decirlo la gente cree que ese codigo esta mal escrito.
      error: "El código NICE lleva letras, números, guiones y la diagonal de la talla.",
    };
  }
  if (name.length < 2) return { ok: false, error: "Escribe el nombre de la pieza." };

  const priceCents = pesosToCents(String(form.get("price") ?? ""));
  if (priceCents === null || priceCents <= 0) {
    return { ok: false, error: "Escribe un precio válido." };
  }

  const stock = Math.floor(Number(form.get("stock")));
  if (!Number.isFinite(stock) || stock < 0 || stock > 9999) {
    return { ok: false, error: "El stock tiene que ser un número entre 0 y 9999." };
  }

  const categoryRaw = Number(form.get("categoryId"));
  const categoryId = Number.isFinite(categoryRaw) && categoryRaw > 0 ? categoryRaw : null;

  const product = await findOrCreateProduct(seller.id, {
    niceCode,
    name,
    description: str(form.get("description"), 600),
    categoryId,
    material: str(form.get("material"), 60),
    finish: str(form.get("finish"), 60),
    imageUrl: str(form.get("imageUrl"), 500),
  });

  const res = await addToInventory(seller.id, {
    productId: product.id,
    priceCents,
    costCents: pesosToCents(String(form.get("cost") ?? "")),
    stock,
  });

  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/${seller.slug}`);
  return { ok: true, message: product.created ? "Pieza creada y agregada" : "Agregada a tu inventario" };
}

// --- Pedidos ---------------------------------------------------------------

export async function setOrderStatus(orderId: number, status: string): Promise<ActionState> {
  const { seller } = await requireSeller();
  if (!isOrderStatus(status)) return { ok: false, error: "Ese estado no existe." };

  const db = await getDb();
  const res = await db
    .update(schema.orders)
    .set({ status, updatedAt: new Date().toISOString() })
    // El `sellerId` en el WHERE es lo que impide mover el pedido de otra tienda.
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.sellerId, seller.id)))
    .returning({ id: schema.orders.id });

  if (res.length === 0) return { ok: false, error: "Ese pedido no es tuyo." };

  /**
   * Un pedido cancelado o entregado suelta sus piezas.
   *
   * Cancelado porque ya no hay nadie esperandolas, y entregado porque en ese
   * punto o ya se registro la venta —y el stock bajo— o ella lo entrego por
   * fuera. En los dos casos seguir reteniendolas escondería mercancía que sí
   * está disponible.
   */
  if (status === "cancelled" || status === "delivered") {
    await releaseOrderHolds(orderId);
    revalidatePath(`/${seller.slug}`);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return OK;
}

// --- Ventas ----------------------------------------------------------------

export async function createSale(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller();

  // Las partidas llegan como pares inventoryId/quantity repetidos.
  const ids = form.getAll("inventoryId").map((v) => Number(v));
  const quantities = form.getAll("quantity").map((v) => Number(v));

  const lines = ids
    .map((inventoryId, i) => ({ inventoryId, quantity: quantities[i] ?? 0 }))
    .filter((l) => Number.isFinite(l.inventoryId) && l.inventoryId > 0 && l.quantity > 0);

  if (lines.length === 0) return { ok: false, error: "Agrega al menos una pieza." };

  const customerName = str(form.get("customerName"), 80);
  const customerPhone = str(form.get("customerPhone"), 20);

  // O los dos, o ninguno: un cliente sin telefono no se puede volver a
  // encontrar, y un telefono sin nombre no le dice nada a nadie.
  if ((customerName && !customerPhone) || (!customerName && customerPhone)) {
    return { ok: false, error: "Para guardar al cliente necesitamos su nombre y su teléfono." };
  }

  // "abonos" manda un anticipo; cualquier otra cosa es pago completo, que es
  // lo que debe pasar si el campo llega vacio o raro.
  const isLayaway = form.get("payMode") === "abonos";
  const downPayment = isLayaway ? pesosToCents(String(form.get("downPayment") ?? "")) : null;

  if (isLayaway && (downPayment === null || downPayment < 0)) {
    return { ok: false, error: "Escribe cuánto te está dejando de anticipo." };
  }

  const res = await registerSale(seller.id, {
    lines,
    paymentMethod: String(form.get("paymentMethod") ?? "efectivo"),
    customerName,
    customerPhone,
    note: str(form.get("note"), 300),
    orderId: numOrNull(form.get("orderId")),
    paidCents: isLayaway ? downPayment : null,
    dueDate: isLayaway ? str(form.get("dueDate"), 10) : null,
    usePoints: isLayaway ? null : numOrNull(form.get("usePoints")),
  });

  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");
  revalidatePath(`/${seller.slug}`);

  revalidatePath("/dashboard/loyalty");

  const parts = [res.balanceCents > 0 ? "Apartado registrado" : "Venta registrada"];
  if (res.pointsSpent > 0) parts.push(`−${res.pointsSpent} puntos usados`);
  else if (res.discountCents > 0) parts.push("cupón aplicado");
  if (res.balanceCents > 0) parts.push(`saldo ${formatMoney(res.balanceCents)}`);
  if (res.pointsEarned > 0) parts.push(`+${res.pointsEarned} puntos`);

  return { ok: true, message: parts.join(" · ") };
}

/**
 * Registrar un abono.
 *
 * Vive junto a las demas acciones del panel y empieza igual que todas, con
 * `requireSeller()`: el id de la venta viene del navegador, pero solo sirve si
 * esa venta es de quien esta pidiendo.
 */
export async function registerPayment(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const saleId = Number(form.get("saleId"));
  if (!Number.isFinite(saleId) || saleId <= 0) {
    return { ok: false, error: "No encontramos esa venta." };
  }

  const amountCents = pesosToCents(String(form.get("amount") ?? ""));
  if (amountCents === null || amountCents <= 0) {
    return { ok: false, error: "Escribe cuánto te está abonando." };
  }

  const res = await addSalePayment(
    seller.id,
    saleId,
    amountCents,
    String(form.get("method") ?? "efectivo"),
    str(form.get("note"), 200)
  );

  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/dashboard/sales/${saleId}`);
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");

  const parts = [res.settled ? "Abono registrado · queda pagada" : "Abono registrado"];
  if (!res.settled) parts.push(`saldo ${formatMoney(res.balanceCents)}`);
  if (res.pointsEarned > 0) parts.push(`+${res.pointsEarned} puntos`);

  return { ok: true, message: parts.join(" · ") };
}

/** Cancelar una venta y devolver las piezas al inventario. */
export async function cancelSaleAction(saleId: number, reason?: string): Promise<ActionState> {
  const { seller } = await requireSeller();

  const res = await cancelSale(seller.id, saleId, reason ?? null);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/dashboard/sales/${saleId}`);
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  revalidatePath(`/${seller.slug}`);

  return { ok: true, message: "Venta cancelada · las piezas volvieron a tu inventario" };
}

/**
 * Calcular de golpe los costos que faltan, con el descuento de la tienda.
 *
 * Es el puente para quien cargo su inventario antes de escribir su descuento:
 * sin esto tendria que abrir pieza por pieza, y con cincuenta piezas eso no lo
 * hace nadie.
 */
export async function fillCostsAction(): Promise<ActionState> {
  const { seller } = await requireSeller();

  const res = await fillMissingCosts(seller.id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard");

  if (res.filled === 0) {
    return {
      ok: true,
      message: "No había piezas con precio de catálogo pendientes de costear.",
    };
  }

  return {
    ok: true,
    message:
      res.filled === 1
        ? "Listo: calculamos el costo de 1 pieza."
        : `Listo: calculamos el costo de ${res.filled} piezas.`,
  };
}

// --- Perfil ----------------------------------------------------------------

export async function saveProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller();

  const businessName = str(form.get("businessName"), 80);
  const whatsapp = str(form.get("whatsapp"), 20);
  if (!businessName) return { ok: false, error: "Tu tienda necesita un nombre." };
  if (!whatsapp) return { ok: false, error: "Sin WhatsApp no te pueden llegar los pedidos." };

  const res = await updateSellerProfile(seller.id, {
    businessName,
    whatsapp,
    description: str(form.get("description"), 400),
    city: str(form.get("city"), 80),
    state: str(form.get("state"), 80),
    instagram: str(form.get("instagram"), 60),
    facebook: str(form.get("facebook"), 120),
    profileImage: str(form.get("profileImage"), 500),
    coverImage: str(form.get("coverImage"), 500),
    tagline: str(form.get("tagline"), 60),
    schedule: str(form.get("schedule"), 160),
    deliveryMethods: str(form.get("deliveryMethods"), 200),
    paymentMethods: str(form.get("paymentMethods"), 200),
    distributorDiscountPct: Number(form.get("distributorDiscountPct") ?? 0),
  });

  if (!res.ok) return { ok: false, error: res.error };

  /**
   * Guardar el descuento cuesta los costos que faltan.
   *
   * Quien carga su inventario y despues escribe su descuento se quedaba con
   * todo sin costear y sin ganancia que ver, sin ninguna pista de que le
   * faltaba un paso. Aqui es donde ella acaba de decir cuanto le descuentan:
   * es el momento exacto para usarlo.
   *
   * Solo llena lo vacio. Un costo capturado a mano es un dato suyo y no se
   * pisa con una estimacion.
   */
  const costs = await fillMissingCosts(seller.id);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard");
  revalidatePath(`/${seller.slug}`);

  if (costs.ok && costs.filled > 0) {
    return {
      ok: true,
      message:
        costs.filled === 1
          ? "Perfil actualizado · calculamos el costo de 1 pieza"
          : `Perfil actualizado · calculamos el costo de ${costs.filled} piezas`,
    };
  }

  return { ok: true, message: "Perfil actualizado" };
}

/**
 * Guarda su version de cada mensaje de WhatsApp.
 *
 * Un campo dejado vacio vuelve al texto de siempre — `updateMessageTemplates`
 * guarda nulo, no una cadena vacia, para no acabar mandando un mensaje en
 * blanco.
 */
export async function saveMessageTemplatesAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const { seller } = await requireSeller();

  await updateMessageTemplates(seller.id, {
    orderGreeting: String(form.get("orderGreeting") ?? ""),
    orderClosing: String(form.get("orderClosing") ?? ""),
    shareMessage: String(form.get("shareMessage") ?? ""),
    paymentReminder: String(form.get("paymentReminder") ?? ""),
    couponMessage: String(form.get("couponMessage") ?? ""),
    pointsGreeting: String(form.get("pointsGreeting") ?? ""),
    pointsClosing: String(form.get("pointsClosing") ?? ""),
  });

  revalidatePath("/dashboard/settings");
  revalidatePath(`/${seller.slug}`);

  return { ok: true, message: "Mensajes guardados" };
}

function str(v: FormDataEntryValue | null, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
