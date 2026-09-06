"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import {
  addToInventory,
  findOrCreateProduct,
  registerSale,
  removeFromInventory,
  updateInventory,
  updateSellerProfile,
} from "@/lib/mutations";
import { pesosToCents } from "@/lib/format";
import { isOrderStatus } from "@/lib/orders";

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

  const res = await updateInventory(seller.id, inventoryId, {
    priceCents,
    stock,
    isVisible: form.get("isVisible") === "on",
    reason: String(form.get("reason") ?? "") || undefined,
  });

  if (!res.ok) return { ok: false, error: res.error };

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
  if (!/^[A-Za-z0-9-]{3,20}$/.test(niceCode)) {
    return { ok: false, error: "El código NICE solo lleva letras, números y guiones (3 a 20)." };
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

  const res = await registerSale(seller.id, {
    lines,
    paymentMethod: String(form.get("paymentMethod") ?? "efectivo"),
    customerName,
    customerPhone,
    note: str(form.get("note"), 300),
    orderId: numOrNull(form.get("orderId")),
  });

  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/customers");
  revalidatePath(`/${seller.slug}`);

  return {
    ok: true,
    message:
      res.pointsEarned > 0
        ? `Venta registrada · +${res.pointsEarned} puntos`
        : "Venta registrada",
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
    schedule: str(form.get("schedule"), 160),
    deliveryMethods: str(form.get("deliveryMethods"), 200),
    paymentMethods: str(form.get("paymentMethods"), 200),
  });

  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/settings");
  revalidatePath(`/${seller.slug}`);
  return { ok: true, message: "Perfil actualizado" };
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
