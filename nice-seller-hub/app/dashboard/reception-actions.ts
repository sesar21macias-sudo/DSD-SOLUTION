"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import {
  assertDraftItem,
  confirmReception,
  createDraftReception,
  searchCatalog,
  type CatalogMatch,
} from "@/lib/receptions";
import { findOrCreateProduct } from "@/lib/mutations";
import { pesosToCents } from "@/lib/format";
import type { ActionState } from "./actions";

/**
 * Acciones de la recepción de mercancía.
 *
 * Todas empiezan por `requireSeller()` y toda edición de un renglón pasa por
 * `assertDraftItem`, que verifica dos cosas a la vez: que el renglón sea de
 * esta distribuidora y que su recepción siga en borrador. Editar una recepción
 * ya confirmada reescribiría un movimiento de inventario que ya ocurrió.
 */

export async function setItemQuantity(
  itemId: number,
  quantity: number
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const receptionId = await assertDraftItem(seller.id, itemId);
  if (receptionId === null) return { ok: false, error: "Ese renglón ya no se puede editar." };

  const qty = Math.max(0, Math.min(999, Math.floor(Number(quantity) || 0)));

  const db = await getDb();
  const rows = await db
    .select({ productId: schema.receptionItems.productId })
    .from(schema.receptionItems)
    .where(eq(schema.receptionItems.id, itemId))
    .limit(1);

  const hasProduct = rows[0]?.productId != null;

  // Cantidad 0 no borra el renglón: lo deja a la vista, descartado, para que se
  // note que estaba en el ticket y se decidió no cargarlo. Al volver a subir,
  // regresa al estado que le corresponde — y un renglón sin producto vuelve a
  // "no encontrado", no a "listo".
  await db
    .update(schema.receptionItems)
    .set({
      quantity: qty,
      status: qty === 0 ? "skipped" : hasProduct ? "matched" : "not_found",
    })
    .where(eq(schema.receptionItems.id, itemId));

  revalidatePath(`/dashboard/inventory/receive/${receptionId}`);
  return { ok: true };
}

export async function setItemPrice(
  itemId: number,
  price: string
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const receptionId = await assertDraftItem(seller.id, itemId);
  if (receptionId === null) return { ok: false, error: "Ese renglón ya no se puede editar." };

  const cents = pesosToCents(price);
  if (cents === null || cents <= 0) return { ok: false, error: "Escribe un precio válido." };

  const db = await getDb();
  await db
    .update(schema.receptionItems)
    .set({ priceCents: cents })
    .where(eq(schema.receptionItems.id, itemId));

  revalidatePath(`/dashboard/inventory/receive/${receptionId}`);
  return { ok: true };
}

export async function removeItem(itemId: number): Promise<ActionState> {
  const { seller } = await requireSeller();

  const receptionId = await assertDraftItem(seller.id, itemId);
  if (receptionId === null) return { ok: false, error: "Ese renglón ya no se puede editar." };

  const db = await getDb();
  await db.delete(schema.receptionItems).where(eq(schema.receptionItems.id, itemId));

  revalidatePath(`/dashboard/inventory/receive/${receptionId}`);
  return { ok: true };
}

/** Busca en el catálogo global para resolver un "Producto no encontrado". */
export async function findInCatalog(query: string): Promise<CatalogMatch[]> {
  await requireSeller();
  return searchCatalog(query);
}

/** Liga un renglón sin producto a una pieza del catálogo. */
export async function linkItemToProduct(
  itemId: number,
  productId: number
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const receptionId = await assertDraftItem(seller.id, itemId);
  if (receptionId === null) return { ok: false, error: "Ese renglón ya no se puede editar." };

  const db = await getDb();
  const rows = await db
    .select({
      id: schema.products.id,
      niceCode: schema.products.niceCode,
      suggestedPriceCents: schema.products.suggestedPriceCents,
    })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);

  const product = rows[0];
  if (!product) return { ok: false, error: "Esa pieza ya no está en el catálogo." };

  // Si ya la tiene en inventario, se respeta el precio que ella puso.
  const own = await db
    .select({ priceCents: schema.sellerInventory.priceCents })
    .from(schema.sellerInventory)
    .where(
      and(
        eq(schema.sellerInventory.sellerId, seller.id),
        eq(schema.sellerInventory.productId, product.id)
      )
    )
    .limit(1);

  await db
    .update(schema.receptionItems)
    .set({
      productId: product.id,
      niceCode: product.niceCode,
      status: "matched",
      priceCents: own[0]?.priceCents ?? product.suggestedPriceCents ?? null,
    })
    .where(eq(schema.receptionItems.id, itemId));

  revalidatePath(`/dashboard/inventory/receive/${receptionId}`);
  return { ok: true, message: "Pieza encontrada" };
}

/**
 * Da de alta en el catálogo global una pieza que no existía y la liga al
 * renglón. Es el último recurso del flujo de "Producto no encontrado": el
 * catálogo debe crecer, pero solo cuando alguien confirma que la pieza es real.
 */
export async function createProductForItem(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const itemId = Number(form.get("itemId"));
  const receptionId = await assertDraftItem(seller.id, itemId);
  if (receptionId === null) return { ok: false, error: "Ese renglón ya no se puede editar." };

  const niceCode = String(form.get("niceCode") ?? "").trim().toUpperCase();
  const name = String(form.get("name") ?? "").trim();
  if (!/^[A-Z0-9-]{3,20}$/.test(niceCode)) {
    return { ok: false, error: "El código NICE solo lleva letras, números y guiones (3 a 20)." };
  }
  if (name.length < 2) return { ok: false, error: "Escribe el nombre de la pieza." };

  const priceCents = pesosToCents(String(form.get("price") ?? ""));
  if (priceCents === null || priceCents <= 0) {
    return { ok: false, error: "Escribe un precio válido." };
  }

  const categoryRaw = Number(form.get("categoryId"));
  const categoryId = Number.isFinite(categoryRaw) && categoryRaw > 0 ? categoryRaw : null;

  const product = await findOrCreateProduct(seller.id, {
    niceCode,
    name,
    categoryId,
    imageUrl: String(form.get("imageUrl") ?? "").trim() || null,
  });

  const db = await getDb();
  await db
    .update(schema.receptionItems)
    .set({ productId: product.id, niceCode, status: "matched", priceCents })
    .where(eq(schema.receptionItems.id, itemId));

  revalidatePath(`/dashboard/inventory/receive/${receptionId}`);
  return { ok: true, message: product.created ? "Pieza creada" : "Pieza encontrada" };
}

/** Agrega un renglón a mano a un borrador. */
export async function addManualItem(
  receptionId: number,
  niceCode: string,
  quantity: number
): Promise<ActionState> {
  const { seller } = await requireSeller();

  const db = await getDb();
  const rows = await db
    .select({ id: schema.receptions.id })
    .from(schema.receptions)
    .where(
      and(
        eq(schema.receptions.id, receptionId),
        eq(schema.receptions.sellerId, seller.id),
        eq(schema.receptions.status, "draft")
      )
    )
    .limit(1);

  if (!rows[0]) return { ok: false, error: "Esa recepción ya no se puede editar." };

  const code = niceCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    return { ok: false, error: "Ese código no se ve válido." };
  }

  const product = await db
    .select({
      id: schema.products.id,
      suggestedPriceCents: schema.products.suggestedPriceCents,
    })
    .from(schema.products)
    .where(eq(schema.products.niceCode, code))
    .limit(1);

  const own = product[0]
    ? await db
        .select({ priceCents: schema.sellerInventory.priceCents })
        .from(schema.sellerInventory)
        .where(
          and(
            eq(schema.sellerInventory.sellerId, seller.id),
            eq(schema.sellerInventory.productId, product[0].id)
          )
        )
        .limit(1)
    : [];

  await db.insert(schema.receptionItems).values({
    receptionId,
    niceCode: code,
    quantity: Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1))),
    productId: product[0]?.id ?? null,
    priceCents: product[0]
      ? (own[0]?.priceCents ?? product[0].suggestedPriceCents ?? null)
      : null,
    status: product[0] ? "matched" : "not_found",
    rawLine: null,
    confidence: "high",
  });

  revalidatePath(`/dashboard/inventory/receive/${receptionId}`);
  return { ok: true };
}

/** Crea un borrador vacío para capturar códigos sin foto. */
export async function startManualReception(): Promise<
  { ok: true; receptionId: number } | { ok: false; error: string }
> {
  const { seller } = await requireSeller();
  const receptionId = await createDraftReception(seller.id, [], "manual");
  return { ok: true, receptionId };
}

export async function cancelReception(receptionId: number): Promise<ActionState> {
  const { seller } = await requireSeller();

  const db = await getDb();
  await db
    .update(schema.receptions)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(schema.receptions.id, receptionId),
        eq(schema.receptions.sellerId, seller.id),
        eq(schema.receptions.status, "draft")
      )
    );

  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

/** El único punto donde una recepción mueve inventario. */
export async function confirmReceptionAction(
  receptionId: number
): Promise<ActionState & { added?: number; increased?: number; pieces?: number; skipped?: number }> {
  const { seller } = await requireSeller();

  const res = await confirmReception(seller.id, receptionId);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  revalidatePath(`/${seller.slug}`);

  const { added, increased, pieces, skipped } = res.result;
  return {
    ok: true,
    message: `${pieces} ${pieces === 1 ? "pieza cargada" : "piezas cargadas"}`,
    added,
    increased,
    pieces,
    skipped,
  };
}
