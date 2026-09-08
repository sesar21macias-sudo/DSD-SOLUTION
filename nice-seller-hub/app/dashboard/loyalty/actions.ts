"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/session";
import {
  adjustPoints,
  cancelRedemption,
  createReward,
  deleteReward,
  markRedemptionUsed,
  saveProgram,
  toggleReward,
  type RewardKind,
} from "@/lib/loyalty";
import { getCustomer } from "@/lib/seller";
import { pesosToCents } from "@/lib/format";

/**
 * Las acciones del club, del lado de la distribuidora.
 *
 * Todas empiezan con `requireSeller()` y le pasan ese `seller.id` a la capa de
 * datos. Ninguna recibe un identificador de tienda: el unico que existe es el
 * de la sesion.
 */

export type LoyaltyState = { ok: boolean; error?: string; message?: string };

function refresh(slug: string) {
  revalidatePath("/dashboard/loyalty");
  revalidatePath("/dashboard/customers");
  revalidatePath(`/${slug}/club`);
  revalidatePath(`/${slug}`);
}

export async function saveProgramAction(
  _prev: LoyaltyState,
  form: FormData
): Promise<LoyaltyState> {
  const { seller } = await requireSeller();

  // Ella escribe "10" pensando en pesos; adentro se guarda en centavos.
  const pesosPerPoint = Number(String(form.get("pesosPerPoint") ?? "10").replace(",", "."));
  if (!Number.isFinite(pesosPerPoint) || pesosPerPoint < 1) {
    return { ok: false, error: "Escribe cuántos pesos vale un punto (mínimo 1)." };
  }

  const welcome = Number(form.get("welcomePoints") ?? 0);
  if (!Number.isFinite(welcome) || welcome < 0) {
    return { ok: false, error: "Los puntos de bienvenida no pueden ser negativos." };
  }

  await saveProgram(seller.id, {
    enabled: form.get("enabled") === "on",
    name: String(form.get("name") ?? "Club de puntos"),
    centsPerPoint: Math.round(pesosPerPoint * 100),
    welcomePoints: Math.round(welcome),
    terms: String(form.get("terms") ?? "") || null,
  });

  refresh(seller.slug);
  return { ok: true, message: "Programa guardado." };
}

export async function createRewardAction(
  _prev: LoyaltyState,
  form: FormData
): Promise<LoyaltyState> {
  const { seller } = await requireSeller();

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 3) return { ok: false, error: "Ponle un nombre a la recompensa." };

  const pointsCost = Number(form.get("pointsCost"));
  if (!Number.isFinite(pointsCost) || pointsCost < 1) {
    return { ok: false, error: "¿Cuántos puntos cuesta? Escribe un número mayor que cero." };
  }

  const kind = String(form.get("kind") ?? "percent") as RewardKind;
  const rawValue = String(form.get("value") ?? "0");

  // Un porcentaje es un entero; un descuento en pesos se guarda en centavos.
  let value = 0;
  if (kind === "percent") {
    value = Math.round(Number(rawValue));
    if (!Number.isFinite(value) || value < 1 || value > 100) {
      return { ok: false, error: "El descuento debe ir entre 1% y 100%." };
    }
  } else if (kind === "amount") {
    value = pesosToCents(rawValue) ?? 0;
    if (value <= 0) return { ok: false, error: "Escribe de cuánto es el descuento." };
  }

  await createReward(seller.id, {
    name,
    description: String(form.get("description") ?? "") || null,
    pointsCost: Math.round(pointsCost),
    kind,
    value,
  });

  refresh(seller.slug);
  return { ok: true, message: "Recompensa agregada." };
}

export async function toggleRewardAction(rewardId: number): Promise<LoyaltyState> {
  const { seller } = await requireSeller();
  await toggleReward(seller.id, rewardId);
  refresh(seller.slug);
  return { ok: true };
}

export async function deleteRewardAction(rewardId: number): Promise<LoyaltyState> {
  const { seller } = await requireSeller();
  await deleteReward(seller.id, rewardId);
  refresh(seller.slug);
  return { ok: true, message: "Recompensa eliminada." };
}

export async function markRedemptionUsedAction(redemptionId: number): Promise<LoyaltyState> {
  const { seller } = await requireSeller();
  await markRedemptionUsed(seller.id, redemptionId);
  refresh(seller.slug);
  return { ok: true, message: "Cupón marcado como usado." };
}

export async function cancelRedemptionAction(redemptionId: number): Promise<LoyaltyState> {
  const { seller } = await requireSeller();
  await cancelRedemption(seller.id, redemptionId);
  refresh(seller.slug);
  return { ok: true, message: "Cupón cancelado; le devolvimos sus puntos." };
}

export async function adjustPointsAction(
  _prev: LoyaltyState,
  form: FormData
): Promise<LoyaltyState> {
  const { seller } = await requireSeller();

  const customerId = Number(form.get("customerId"));
  const delta = Number(form.get("delta"));
  if (!Number.isInteger(customerId) || !Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: "Escribe cuántos puntos quieres sumar o restar." };
  }
  if (Math.abs(delta) > 100_000) {
    return { ok: false, error: "Ese ajuste es demasiado grande." };
  }

  // Solo se pueden ajustar los puntos de alguien de la propia cartera. Sin
  // esta comprobacion, un id escrito a mano dejaria tocar la cuenta que lleva
  // otra distribuidora con esa misma persona.
  const customer = await getCustomer(seller.id, customerId);
  if (!customer) return { ok: false, error: "Esa persona no está en tu cartera." };

  await adjustPoints(seller.id, customerId, delta, String(form.get("reason") ?? ""));

  revalidatePath(`/dashboard/customers/${customerId}`);
  refresh(seller.slug);
  return { ok: true, message: delta > 0 ? "Puntos agregados." : "Puntos descontados." };
}
