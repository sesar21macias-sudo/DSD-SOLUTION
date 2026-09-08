import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { LoyaltyProgram, LoyaltyReward } from "@/db/schema";
import {
  DEFAULT_CENTS_PER_POINT,
  MAX_CENTS_PER_POINT,
  MIN_CENTS_PER_POINT,
  pointsForSale,
  type RewardKind,
} from "./loyalty-rules";

/**
 * El club de cada distribuidora.
 *
 * Toda la logica de puntos vive aqui, en un solo archivo, y toda ella recibe
 * un `sellerId`. No existe un saldo global: los puntos que una clienta junto
 * comprandole a Ana no valen nada con Maria, igual que la tarjeta de una
 * cafeteria no sirve en la de enfrente. Cada distribuidora pone sus reglas,
 * sus recompensas y ve unicamente a sus propias clientas.
 */

export * from "./loyalty-rules";

// --- El programa de una tienda ---------------------------------------------

/**
 * Devuelve el programa de esta distribuidora, creandolo con valores razonables
 * si es la primera vez. Que siempre exista una fila le quita a cada pantalla
 * el caso de "todavia no hay configuracion".
 */
export async function getProgram(sellerId: number): Promise<LoyaltyProgram> {
  const db = await getDb();

  const read = async () =>
    (
      await db
        .select()
        .from(schema.loyaltyPrograms)
        .where(eq(schema.loyaltyPrograms.sellerId, sellerId))
        .limit(1)
    )[0];

  const existing = await read();
  if (existing) return existing;

  await db
    .insert(schema.loyaltyPrograms)
    .values({ sellerId, enabled: false })
    .onConflictDoNothing();

  const created = await read();
  if (created) return created;

  // Si aun asi no aparece, la base esta en un estado raro; devolver algo
  // apagado es mejor que reventar la tienda publica.
  return {
    id: 0,
    sellerId,
    enabled: false,
    name: "Club de puntos",
    centsPerPoint: DEFAULT_CENTS_PER_POINT,
    welcomePoints: 0,
    terms: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export interface ProgramInput {
  enabled: boolean;
  name: string;
  centsPerPoint: number;
  welcomePoints: number;
  terms: string | null;
}

export async function saveProgram(sellerId: number, input: ProgramInput): Promise<void> {
  await getProgram(sellerId); // asegura la fila
  const db = await getDb();

  await db
    .update(schema.loyaltyPrograms)
    .set({
      enabled: input.enabled,
      name: input.name.trim().slice(0, 40) || "Club NICE",
      centsPerPoint: Math.min(
        MAX_CENTS_PER_POINT,
        Math.max(MIN_CENTS_PER_POINT, Math.round(input.centsPerPoint))
      ),
      welcomePoints: Math.min(5_000, Math.max(0, Math.round(input.welcomePoints))),
      terms: input.terms?.trim().slice(0, 600) || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.loyaltyPrograms.sellerId, sellerId));
}

// --- Recompensas -----------------------------------------------------------

export async function listRewards(sellerId: number, onlyActive = false): Promise<LoyaltyReward[]> {
  const db = await getDb();
  const conditions = [eq(schema.loyaltyRewards.sellerId, sellerId)];
  if (onlyActive) conditions.push(eq(schema.loyaltyRewards.isActive, true));

  return db
    .select()
    .from(schema.loyaltyRewards)
    .where(and(...conditions))
    .orderBy(schema.loyaltyRewards.pointsCost);
}

export interface RewardInput {
  name: string;
  description: string | null;
  pointsCost: number;
  kind: RewardKind;
  value: number;
}

export async function createReward(sellerId: number, input: RewardInput): Promise<void> {
  const db = await getDb();
  await db.insert(schema.loyaltyRewards).values({
    sellerId,
    name: input.name.trim().slice(0, 80),
    description: input.description?.trim().slice(0, 200) || null,
    pointsCost: Math.max(1, Math.round(input.pointsCost)),
    kind: input.kind,
    value: Math.max(0, Math.round(input.value)),
    isActive: true,
  });
}

/** El `sellerId` en el WHERE es lo que impide tocar la recompensa de otra. */
export async function toggleReward(sellerId: number, rewardId: number): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.loyaltyRewards)
    .set({ isActive: sql`NOT ${schema.loyaltyRewards.isActive}` })
    .where(
      and(eq(schema.loyaltyRewards.id, rewardId), eq(schema.loyaltyRewards.sellerId, sellerId))
    );
}

/**
 * Borra una recompensa. Los cupones ya canjeados NO se tocan: alguien tiene
 * ese codigo guardado en su telefono y sigue teniendo derecho a el.
 */
export async function deleteReward(sellerId: number, rewardId: number): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.loyaltyRewards)
    .where(
      and(eq(schema.loyaltyRewards.id, rewardId), eq(schema.loyaltyRewards.sellerId, sellerId))
    );
}

// --- Cuentas y puntos ------------------------------------------------------

export interface LoyaltyAccountView {
  id: number;
  points: number;
  lifetimePoints: number;
}

export async function getAccount(
  sellerId: number,
  customerId: number
): Promise<LoyaltyAccountView> {
  const db = await getDb();

  const read = async () =>
    (
      await db
        .select({
          id: schema.loyaltyAccounts.id,
          points: schema.loyaltyAccounts.points,
          lifetimePoints: schema.loyaltyAccounts.lifetimePoints,
        })
        .from(schema.loyaltyAccounts)
        .where(
          and(
            eq(schema.loyaltyAccounts.sellerId, sellerId),
            eq(schema.loyaltyAccounts.customerId, customerId)
          )
        )
        .limit(1)
    )[0];

  const existing = await read();
  if (existing) return existing;

  await db
    .insert(schema.loyaltyAccounts)
    .values({ sellerId, customerId, points: 0, lifetimePoints: 0 })
    .onConflictDoNothing();

  return (await read()) ?? { id: 0, points: 0, lifetimePoints: 0 };
}

/**
 * Suma o resta puntos y deja el movimiento escrito.
 *
 * El acumulado historico solo sube: es lo que define el nivel, y bajarlo al
 * canjear haria que una clienta perdiera su nivel justo por usar el club.
 */
async function movePoints(
  accountId: number,
  delta: number,
  type: string,
  description: string,
  referenceId: number | null = null
): Promise<void> {
  if (accountId === 0 || delta === 0) return;
  const db = await getDb();

  await db
    .update(schema.loyaltyAccounts)
    .set({
      points: sql`max(0, ${schema.loyaltyAccounts.points} + ${delta})`,
      lifetimePoints:
        delta > 0
          ? sql`${schema.loyaltyAccounts.lifetimePoints} + ${delta}`
          : schema.loyaltyAccounts.lifetimePoints,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.loyaltyAccounts.id, accountId));

  await db.insert(schema.loyaltyTransactions).values({
    accountId,
    type,
    points: delta,
    description,
    referenceId,
  });
}

/**
 * Acumula los puntos de una venta. Si el club esta apagado no acumula nada:
 * de otro modo alguien podria encenderlo un año despues y encontrarse con
 * saldos que nunca ofrecio.
 */
export async function awardPointsForSale(
  sellerId: number,
  customerId: number,
  saleId: number,
  totalCents: number
): Promise<number> {
  const program = await getProgram(sellerId);
  if (!program.enabled) return 0;

  const points = pointsForSale(totalCents, program.centsPerPoint);
  if (points <= 0) return 0;

  const account = await getAccount(sellerId, customerId);
  await movePoints(account.id, points, "earn", "Puntos por compra", saleId);
  return points;
}

/** Los puntos de bienvenida, una sola vez, al registrarse en el club. */
export async function awardWelcomePoints(sellerId: number, customerId: number): Promise<number> {
  const program = await getProgram(sellerId);
  if (!program.enabled || program.welcomePoints <= 0) return 0;

  const db = await getDb();
  const account = await getAccount(sellerId, customerId);

  const already = await db
    .select({ id: schema.loyaltyTransactions.id })
    .from(schema.loyaltyTransactions)
    .where(
      and(
        eq(schema.loyaltyTransactions.accountId, account.id),
        eq(schema.loyaltyTransactions.type, "welcome")
      )
    )
    .limit(1);

  if (already.length > 0) return 0;

  await movePoints(account.id, program.welcomePoints, "welcome", "Puntos de bienvenida");
  return program.welcomePoints;
}

/** Ajuste a mano desde el panel: un regalo, una correccion, una disculpa. */
export async function adjustPoints(
  sellerId: number,
  customerId: number,
  delta: number,
  reason: string
): Promise<void> {
  const account = await getAccount(sellerId, customerId);
  await movePoints(
    account.id,
    Math.round(delta),
    "adjust",
    reason.trim().slice(0, 120) || "Ajuste manual"
  );
}

export interface PointsMovement {
  id: number;
  type: string;
  points: number;
  description: string | null;
  createdAt: string;
}

export async function listMovements(
  sellerId: number,
  customerId: number,
  limit = 20
): Promise<PointsMovement[]> {
  const account = await getAccount(sellerId, customerId);
  if (account.id === 0) return [];

  const db = await getDb();
  return db
    .select({
      id: schema.loyaltyTransactions.id,
      type: schema.loyaltyTransactions.type,
      points: schema.loyaltyTransactions.points,
      description: schema.loyaltyTransactions.description,
      createdAt: schema.loyaltyTransactions.createdAt,
    })
    .from(schema.loyaltyTransactions)
    .where(eq(schema.loyaltyTransactions.accountId, account.id))
    .orderBy(desc(schema.loyaltyTransactions.createdAt))
    .limit(limit);
}

// --- Canje -----------------------------------------------------------------

/**
 * Alfabeto sin 0/O ni 1/I/L: el codigo se dicta por WhatsApp y se teclea a
 * mano, y esos pares son exactamente los que se confunden.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const body = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `NC-${body.slice(0, 3)}-${body.slice(3)}`;
}

export type RedeemResult =
  | { ok: true; code: string; name: string; pointsSpent: number }
  | { ok: false; error: string };

/**
 * Cambia puntos por un cupon.
 *
 * El descuento de puntos se hace con `points >= costo` en el propio UPDATE: si
 * alguien presiona canjear dos veces —o desde dos telefonos— la segunda no
 * afecta ninguna fila y no se emite el cupon. Comprobar antes y restar despues
 * dejaria una ventana para canjear dos veces con el saldo de una.
 */
export async function redeemReward(
  sellerId: number,
  customerId: number,
  rewardId: number
): Promise<RedeemResult> {
  const db = await getDb();

  const program = await getProgram(sellerId);
  if (!program.enabled) return { ok: false, error: "Este club no está activo." };

  const rows = await db
    .select()
    .from(schema.loyaltyRewards)
    .where(
      and(
        eq(schema.loyaltyRewards.id, rewardId),
        eq(schema.loyaltyRewards.sellerId, sellerId),
        eq(schema.loyaltyRewards.isActive, true)
      )
    )
    .limit(1);

  const reward = rows[0];
  if (!reward) return { ok: false, error: "Esa recompensa ya no está disponible." };

  const account = await getAccount(sellerId, customerId);
  if (account.id === 0) return { ok: false, error: "No encontramos tu cuenta." };
  if (account.points < reward.pointsCost) {
    return { ok: false, error: "Todavía no tienes suficientes puntos para esta recompensa." };
  }

  const updated = await db
    .update(schema.loyaltyAccounts)
    .set({
      points: sql`${schema.loyaltyAccounts.points} - ${reward.pointsCost}`,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.loyaltyAccounts.id, account.id),
        sql`${schema.loyaltyAccounts.points} >= ${reward.pointsCost}`
      )
    )
    .returning({ id: schema.loyaltyAccounts.id });

  if (updated.length === 0) {
    return { ok: false, error: "Tus puntos cambiaron. Vuelve a intentarlo." };
  }

  const code = newCode();

  await db.insert(schema.loyaltyRedemptions).values({
    sellerId,
    customerId,
    rewardId: reward.id,
    code,
    pointsSpent: reward.pointsCost,
    nameSnapshot: reward.name,
    kind: reward.kind,
    value: reward.value,
    status: "available",
  });

  await db.insert(schema.loyaltyTransactions).values({
    accountId: account.id,
    type: "redeem",
    points: -reward.pointsCost,
    description: `Canje: ${reward.name}`,
  });

  return { ok: true, code, name: reward.name, pointsSpent: reward.pointsCost };
}

export interface RedemptionView {
  id: number;
  code: string;
  nameSnapshot: string;
  kind: string;
  value: number;
  pointsSpent: number;
  status: string;
  createdAt: string;
  usedAt: string | null;
  customerId: number;
  customerName: string | null;
  customerPhone: string | null;
}

export async function listRedemptions(
  sellerId: number,
  status?: string
): Promise<RedemptionView[]> {
  const db = await getDb();
  const conditions = [eq(schema.loyaltyRedemptions.sellerId, sellerId)];
  if (status) conditions.push(eq(schema.loyaltyRedemptions.status, status));

  return db
    .select({
      id: schema.loyaltyRedemptions.id,
      code: schema.loyaltyRedemptions.code,
      nameSnapshot: schema.loyaltyRedemptions.nameSnapshot,
      kind: schema.loyaltyRedemptions.kind,
      value: schema.loyaltyRedemptions.value,
      pointsSpent: schema.loyaltyRedemptions.pointsSpent,
      status: schema.loyaltyRedemptions.status,
      createdAt: schema.loyaltyRedemptions.createdAt,
      usedAt: schema.loyaltyRedemptions.usedAt,
      customerId: schema.loyaltyRedemptions.customerId,
      customerName: schema.customers.name,
      customerPhone: schema.customers.phone,
    })
    .from(schema.loyaltyRedemptions)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.loyaltyRedemptions.customerId))
    .where(and(...conditions))
    .orderBy(desc(schema.loyaltyRedemptions.createdAt))
    .limit(100);
}

export async function listCustomerRedemptions(
  sellerId: number,
  customerId: number
): Promise<RedemptionView[]> {
  const all = await listRedemptions(sellerId);
  return all.filter((r) => r.customerId === customerId);
}

/** El cupon vigente que corresponde a un codigo, o null. */
export async function findAvailableRedemption(sellerId: number, code: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.loyaltyRedemptions)
    .where(
      and(
        eq(schema.loyaltyRedemptions.sellerId, sellerId),
        eq(schema.loyaltyRedemptions.code, code.trim().toUpperCase()),
        eq(schema.loyaltyRedemptions.status, "available")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function markRedemptionUsed(
  sellerId: number,
  redemptionId: number,
  orderId: number | null = null
): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.loyaltyRedemptions)
    .set({ status: "used", usedAt: new Date().toISOString(), orderId })
    .where(
      and(
        eq(schema.loyaltyRedemptions.id, redemptionId),
        eq(schema.loyaltyRedemptions.sellerId, sellerId),
        eq(schema.loyaltyRedemptions.status, "available")
      )
    );
}

/**
 * Cancela un cupon y le devuelve los puntos a la clienta. Es lo correcto: si
 * la distribuidora ya no puede honrarlo, quien no debe perder es quien junto
 * los puntos.
 */
export async function cancelRedemption(sellerId: number, redemptionId: number): Promise<void> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(schema.loyaltyRedemptions)
    .where(
      and(
        eq(schema.loyaltyRedemptions.id, redemptionId),
        eq(schema.loyaltyRedemptions.sellerId, sellerId),
        eq(schema.loyaltyRedemptions.status, "available")
      )
    )
    .limit(1);

  const redemption = rows[0];
  if (!redemption) return;

  await db
    .update(schema.loyaltyRedemptions)
    .set({ status: "cancelled" })
    .where(eq(schema.loyaltyRedemptions.id, redemption.id));

  const account = await getAccount(sellerId, redemption.customerId);
  await movePoints(
    account.id,
    redemption.pointsSpent,
    "adjust",
    `Cupón cancelado: ${redemption.nameSnapshot}`
  );
}
