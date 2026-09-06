import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Reglas de lealtad. La interfaz de recompensas y cupones es Fase 2, pero los
 * puntos se acumulan desde ahora con cada venta: cuando esa pantalla exista,
 * el historial ya va a estar completo en vez de empezar en cero.
 *
 * Las reglas viven aqui, en un solo lugar, porque estan pensadas para ser
 * configurables por tienda mas adelante (§34).
 */

/** 1 punto por cada $10 MXN. En centavos: 1000. */
export const CENTS_PER_POINT = 1_000;

export interface Tier {
  id: string;
  name: string;
  min: number;
  /** Clases del badge. */
  className: string;
}

export const TIERS: Tier[] = [
  { id: "member", name: "NICE MEMBER", min: 0, className: "bg-neutral-100 text-neutral-600" },
  { id: "gold", name: "NICE GOLD", min: 1_000, className: "bg-amber-100 text-amber-800" },
  { id: "vip", name: "NICE VIP", min: 2_500, className: "bg-neutral-900 text-white" },
];

export function tierFor(points: number): Tier {
  // De mayor a menor: el primero que alcance es el suyo.
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

/** Cuanto le falta para el siguiente nivel, o null si ya esta en el tope. */
export function pointsToNextTier(points: number): { tier: Tier; missing: number } | null {
  const next = TIERS.find((t) => t.min > points);
  return next ? { tier: next, missing: next.min - points } : null;
}

export function pointsForSale(totalCents: number): number {
  return Math.floor(totalCents / CENTS_PER_POINT);
}

/**
 * Acumula los puntos de una venta. Crea la cuenta de lealtad si es la primera
 * compra de esa persona con esa distribuidora — cada tienda lleva su propio
 * saldo, no hay una bolsa global de puntos.
 */
export async function awardPointsForSale(
  sellerId: number,
  customerId: number,
  saleId: number,
  totalCents: number
): Promise<number> {
  const points = pointsForSale(totalCents);
  if (points <= 0) return 0;

  const db = await getDb();

  await db
    .insert(schema.loyaltyAccounts)
    .values({ sellerId, customerId, points: 0 })
    .onConflictDoNothing();

  const rows = await db
    .select()
    .from(schema.loyaltyAccounts)
    .where(
      and(
        eq(schema.loyaltyAccounts.sellerId, sellerId),
        eq(schema.loyaltyAccounts.customerId, customerId)
      )
    )
    .limit(1);

  const account = rows[0];
  if (!account) return 0;

  await db
    .update(schema.loyaltyAccounts)
    .set({
      points: sql`${schema.loyaltyAccounts.points} + ${points}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.loyaltyAccounts.id, account.id));

  await db.insert(schema.loyaltyTransactions).values({
    accountId: account.id,
    type: "earn",
    points,
    description: "Puntos por compra",
    referenceId: saleId,
  });

  return points;
}
