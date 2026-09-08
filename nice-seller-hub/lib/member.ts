import "server-only";

import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Customer } from "@/db/schema";
import { MEMBER_COOKIE, MEMBER_DAYS, readMember, signMember, sessionCookieOptions } from "./auth";
import { getSessionSecret } from "./secret";
import { normalizePhone } from "./phone";
import { awardWelcomePoints, getAccount, getProgram } from "./loyalty";

/**
 * La sesion de una clienta del club.
 *
 * Aqui no hay contraseñas a proposito. Pedirle a alguien que invente y recuerde
 * una contraseña para consultar sus puntos de una joyeria es la forma mas
 * segura de que nadie use el club. La identidad es el telefono mas el nombre:
 * quien quiera entrar a la cuenta de otra persona necesita las dos cosas.
 *
 * Es una decision consciente y tiene un limite claro: lo unico que hay del
 * otro lado son puntos y cupones de una sola tienda. No hay datos de pago, ni
 * domicilio, ni forma de gastar dinero de nadie. Si algun dia el club guarda
 * algo mas delicado que eso, esta puerta tiene que cambiar.
 *
 * La cookie ademas trae el `sellerId`: una sesion del club de Ana no sirve en
 * la tienda de Maria ni aunque se copie a mano.
 */

export interface MemberSession {
  customer: Customer;
  points: number;
  lifetimePoints: number;
}

/** Quita acentos y todo lo que no sea letra: "Ana Sofía" y "ana sofia" son la misma. */
function nameKey(value: string): string {
  // NFD separa la letra de su acento, y el filtro de a-z se lleva el acento
  // junto con espacios y guiones. Una sola pasada y sin rangos invisibles.
  return value.normalize("NFD").toLowerCase().replace(/[^a-z]/g, "");
}

/** El primer nombre, que es lo que se compara para reconocer a alguien. */
function firstNameKey(fullName: string): string {
  return nameKey(fullName.trim().split(/\s+/)[0] ?? "");
}

/**
 * La clienta que tiene sesion abierta EN ESTA TIENDA, o null.
 *
 * Recibe el `sellerId` de la pagina —que sale del slug de la URL— y lo compara
 * con el que trae la cookie. Sin esa comparacion, la cookie del club de una
 * tienda abriria la de todas.
 */
export async function getMember(sellerId: number): Promise<MemberSession | null> {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token) return null;

  const claims = await readMember(token, await getSessionSecret());
  if (!claims || claims.sid !== sellerId) return null;

  const db = await getDb();

  // La relacion con la tienda se vuelve a comprobar contra la base: si la
  // distribuidora borro a esa clienta, la cookie deja de valer sola.
  const rows = await db
    .select({ customer: schema.customers })
    .from(schema.sellerCustomers)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.sellerCustomers.customerId))
    .where(
      and(
        eq(schema.sellerCustomers.sellerId, sellerId),
        eq(schema.sellerCustomers.customerId, claims.cid)
      )
    )
    .limit(1);

  const customer = rows[0]?.customer;
  if (!customer) return null;

  const account = await getAccount(sellerId, customer.id);
  return { customer, points: account.points, lifetimePoints: account.lifetimePoints };
}

export type JoinResult =
  | { ok: true; customerId: number; welcomePoints: number; returning: boolean }
  | { ok: false; error: string };

/**
 * Entrar al club: registra a quien es nueva y reconoce a quien ya estaba.
 *
 * Es una sola operacion y un solo formulario porque desde el lado de la
 * clienta es una sola cosa —"quiero mis puntos"— y porque ella no tiene forma
 * de saber si la distribuidora ya la dio de alta al registrarle una venta.
 *
 * Si el telefono ya existe pero el nombre no coincide, no se entra: ese
 * telefono ya es de alguien.
 */
export async function joinClub(
  sellerId: number,
  firstName: string,
  lastName: string,
  rawPhone: string
): Promise<JoinResult> {
  const program = await getProgram(sellerId);
  if (!program.enabled) return { ok: false, error: "Esta tienda no tiene club de puntos." };

  const first = firstName.trim().replace(/\s+/g, " ").slice(0, 40);
  const last = lastName.trim().replace(/\s+/g, " ").slice(0, 60);

  if (first.length < 2) return { ok: false, error: "Escribe tu nombre." };
  if (last.length < 2) return { ok: false, error: "Escribe tu apellido." };

  const phone = normalizePhone(rawPhone);
  if (!phone.ok) {
    return { ok: false, error: phone.error ?? "Ese teléfono no se ve completo." };
  }

  const fullName = `${first} ${last}`;
  const db = await getDb();

  const existing = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.phone, phone.value))
    .limit(1);

  let customerId: number;
  let returning = false;

  if (existing[0]) {
    if (firstNameKey(existing[0].name) !== firstNameKey(fullName)) {
      return {
        ok: false,
        error:
          "Ese teléfono ya está registrado con otro nombre. Escríbelo como se lo diste a tu distribuidora.",
      };
    }
    customerId = existing[0].id;
    returning = true;

    // Si antes solo se guardo el nombre de pila —pasa cuando la alta vino de
    // una venta rapida— ahora que ella escribio su apellido, se completa.
    if (nameKey(existing[0].name).length < nameKey(fullName).length) {
      await db
        .update(schema.customers)
        .set({ name: fullName })
        .where(eq(schema.customers.id, customerId));
    }
  } else {
    await db
      .insert(schema.customers)
      .values({ name: fullName, phone: phone.value })
      .onConflictDoNothing();

    const created = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.phone, phone.value))
      .limit(1);

    if (!created[0]) return { ok: false, error: "No pudimos crear tu cuenta. Intenta otra vez." };
    customerId = created[0].id;
  }

  // Ya existia como clienta de esta tienda?
  const link = await db
    .select({ id: schema.sellerCustomers.id })
    .from(schema.sellerCustomers)
    .where(
      and(
        eq(schema.sellerCustomers.sellerId, sellerId),
        eq(schema.sellerCustomers.customerId, customerId)
      )
    )
    .limit(1);

  if (link.length === 0) {
    returning = false;
    await db
      .insert(schema.sellerCustomers)
      .values({ sellerId, customerId })
      .onConflictDoNothing();
  }

  await getAccount(sellerId, customerId);
  const welcomePoints = await awardWelcomePoints(sellerId, customerId);

  await openMemberSession(sellerId, customerId);

  return { ok: true, customerId, welcomePoints, returning };
}

export async function openMemberSession(sellerId: number, customerId: number): Promise<void> {
  const token = await signMember({ cid: customerId, sid: sellerId }, await getSessionSecret());
  (await cookies()).set(MEMBER_COOKIE, token, sessionCookieOptions(MEMBER_DAYS));
}

export async function closeMemberSession(): Promise<void> {
  (await cookies()).set(MEMBER_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}
