"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSellerBySlug } from "@/lib/store";
import { closeMemberSession, getMember, joinClub } from "@/lib/member";
import { redeemReward } from "@/lib/loyalty";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Las acciones del club, del lado de la clienta.
 *
 * Todas empiezan resolviendo el slug de la URL a una tienda y todas trabajan
 * con ese `sellerId`. Ningun identificador de tienda ni de clienta llega desde
 * el formulario: si llegara, bastaria con cambiarlo en el navegador para
 * canjear puntos en la cuenta de alguien mas.
 */

export type ClubState = { ok: boolean; error?: string; message?: string };

/** La IP para los limites. Igual que en el resto de endpoints publicos. */
async function ip(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
}

export async function joinClubAction(_prev: ClubState, form: FormData): Promise<ClubState> {
  const slug = String(form.get("slug") ?? "");
  const seller = await getSellerBySlug(slug);
  if (!seller) return { ok: false, error: "Esta tienda no existe." };

  // El formulario es publico y sin contraseña: sin limite, alguien podria
  // probar telefonos hasta encontrar cuentas. 10 por hora alcanza de sobra
  // para una persona que se equivoco al teclear.
  const limit = await rateLimit("club-join", `${seller.id}:${await ip()}`, 10, 3600);
  if (!limit.ok) {
    return { ok: false, error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez." };
  }

  const result = await joinClub(
    seller.id,
    String(form.get("firstName") ?? ""),
    String(form.get("lastName") ?? ""),
    String(form.get("phone") ?? "")
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/${slug}/club`);

  return {
    ok: true,
    message: result.welcomePoints
      ? `¡Bienvenida! Te regalamos ${result.welcomePoints} puntos.`
      : result.returning
        ? "Ya estabas registrada. Estos son tus puntos."
        : "Listo, ya eres parte del club.",
  };
}

export async function redeemAction(_prev: ClubState, form: FormData): Promise<ClubState> {
  const slug = String(form.get("slug") ?? "");
  const seller = await getSellerBySlug(slug);
  if (!seller) return { ok: false, error: "Esta tienda no existe." };

  // La clienta sale de la cookie, no del formulario.
  const member = await getMember(seller.id);
  if (!member) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar al club." };

  const rewardId = Number(form.get("rewardId"));
  if (!Number.isInteger(rewardId)) return { ok: false, error: "Esa recompensa no existe." };

  const result = await redeemReward(seller.id, member.customer.id, rewardId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/${slug}/club`);
  return { ok: true, message: `Cupón listo: ${result.code}` };
}

export async function leaveClubAction(): Promise<void> {
  await closeMemberSession();
}
