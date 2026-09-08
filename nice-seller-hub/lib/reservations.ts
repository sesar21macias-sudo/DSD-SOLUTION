import "server-only";

import { cookies } from "next/headers";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { randomHex } from "./auth";
import { sessionCookieOptions } from "./auth";

/**
 * Apartado temporal de piezas.
 *
 * Dos clientas abren la misma tienda un sabado, las dos ven "queda 1", las dos
 * mandan su pedido y una se queda sin nada. El inventario decia la verdad en
 * los dos momentos: lo que faltaba era que la primera en tomarla la retuviera
 * mientras decide.
 *
 * Reglas de las que cuelga todo lo demas:
 *
 * 1. **Una reserva no baja el stock.** El stock son las piezas que ella tiene
 *    en su casa. Lo que cambia es cuantas estan disponibles *para alguien mas*.
 * 2. **Siempre vence.** Un apartado eterno es una pieza perdida: nadie va a
 *    volver a ese carrito y nadie mas la va a poder comprar.
 * 3. **Vence solo.** Las consultas filtran por `expires_at > ahora`, asi que
 *    una reserva vencida deja de contar sin que nada tenga que ir a borrarla.
 *    La limpieza que si ocurre es por higiene, no por correccion.
 * 4. **Tus propias reservas no te estorban.** Al calcular disponibilidad se
 *    excluyen las del visitante que pregunta; si no, tu propio carrito te
 *    diria que la pieza que ya apartaste esta agotada.
 */

/**
 * Cuanto dura un apartado de carrito.
 *
 * Quince minutos es el punto donde las dos molestias son chicas: alcanza para
 * escoger con calma y mandar el pedido, y una pieza que alguien abandono vuelve
 * a la tienda antes de que la siguiente clienta se de por vencida. Una tienda
 * de joyeria con una sola pieza de cada cosa no puede permitirse mas.
 */
export const CART_HOLD_MINUTES = 15;

/**
 * Un pedido ya mandado por WhatsApp aguanta mucho mas: del otro lado hay una
 * conversacion de verdad, y la distribuidora puede tardar en contestar porque
 * estaba trabajando. Un dia es lo que tarda una venta real en cerrarse.
 */
export const ORDER_HOLD_HOURS = 24;

/** Cuando el aviso deja de ser informativo y pasa a ser urgente. */
export const HOLD_WARNING_MINUTES = 3;

const VISITOR_COOKIE = "nsh_visitor";
const VISITOR_DAYS = 365;

function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/**
 * Quien esta preguntando, o null si todavia no tiene identidad.
 *
 * Solo lectura: las paginas de servidor no pueden escribir cookies, asi que la
 * cookie la crea el endpoint que aparta. Que no exista significa que esa
 * persona no tiene nada apartado, que es exactamente lo que hay que suponer.
 */
export async function getVisitorId(): Promise<string | null> {
  return (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
}

/** Devuelve el identificador del visitante, creandolo si es su primera vez. */
export async function ensureVisitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;

  const fresh = randomHex(16);
  // `httpOnly` no es por seguridad —no protege nada valioso— sino para que no
  // ande dando vueltas en el JavaScript de la pagina sin razon.
  jar.set(VISITOR_COOKIE, fresh, sessionCookieOptions(VISITOR_DAYS));
  return fresh;
}

/**
 * La expresion SQL de "cuantas piezas tiene apartadas alguien mas".
 *
 * Se escribe una sola vez y se usa en las tres consultas que deciden si algo
 * esta disponible. Tenerla en tres lugares distintos es como se acaba con una
 * tienda que dice una cosa en la lista y otra en el detalle.
 *
 * `productColumn` se recibe ya calificada con su tabla: dentro de una
 * subconsulta correlacionada, un nombre suelto se resuelve contra la tabla de
 * adentro y devuelve un numero plausible pero equivocado.
 */
export function reservedByOthersSql(
  sellerId: number,
  productColumn: ReturnType<typeof sql.raw>,
  visitorId: string | null
) {
  const now = new Date().toISOString();
  const mine = visitorId ?? "";

  return sql<number>`(
    select coalesce(sum(quantity), 0) from stock_reservations
    where seller_id = ${sellerId}
      and product_id = ${productColumn}
      and visitor_id <> ${mine}
      and expires_at > ${now}
  )`;
}

export interface HeldItem {
  productId: number;
  niceCode: string;
  name: string;
  /** Lo que pidio apartar. */
  requested: number;
  /** Lo que se le pudo apartar de verdad. */
  held: number;
  /** Lo que hay disponible para esta persona ahora mismo. */
  available: number;
}

export interface HoldResult {
  expiresAt: string;
  items: HeldItem[];
  /** Las que no se pudieron apartar completas. */
  problems: HeldItem[];
}

/**
 * Aparta (o renueva) las piezas de un carrito.
 *
 * Es idempotente: llamarla otra vez con el mismo carrito renueva el
 * vencimiento en lugar de apartar el doble. Por eso la tabla tiene una fila
 * unica por (tienda, pieza, visitante) y esto es un upsert.
 *
 * Lo que no cabe no se aparta y se devuelve como problema, en vez de fallar
 * entero: si alguien pidio tres piezas y solo queda una, apartarle esa una es
 * mejor que dejarla libre mientras le explicamos el error.
 */
export async function holdCartItems(
  sellerId: number,
  visitorId: string,
  lines: { niceCode: string; quantity: number }[]
): Promise<HoldResult> {
  const db = await getDb();
  const expiresAt = isoIn(CART_HOLD_MINUTES * 60_000);
  const now = new Date().toISOString();

  const codes = lines.map((l) => l.niceCode);

  const rows = codes.length
    ? await db
        .select({
          productId: schema.products.id,
          niceCode: schema.products.niceCode,
          name: schema.products.name,
          stock: schema.sellerInventory.stock,
          isVisible: schema.sellerInventory.isVisible,
        })
        .from(schema.sellerInventory)
        .innerJoin(schema.products, eq(schema.products.id, schema.sellerInventory.productId))
        .where(
          and(
            eq(schema.sellerInventory.sellerId, sellerId),
            inArray(schema.products.niceCode, codes)
          )
        )
    : [];

  const byCode = new Map(rows.map((r) => [r.niceCode, r]));

  // Lo apartado por otros, en una sola consulta para todas las piezas.
  const productIds = rows.map((r) => r.productId);
  const othersRows = productIds.length
    ? await db
        .select({
          productId: schema.stockReservations.productId,
          quantity: sql<number>`coalesce(sum(${schema.stockReservations.quantity}), 0)`,
        })
        .from(schema.stockReservations)
        .where(
          and(
            eq(schema.stockReservations.sellerId, sellerId),
            inArray(schema.stockReservations.productId, productIds),
            ne(schema.stockReservations.visitorId, visitorId),
            gt(schema.stockReservations.expiresAt, now)
          )
        )
        .groupBy(schema.stockReservations.productId)
    : [];

  const othersByProduct = new Map(othersRows.map((r) => [r.productId, r.quantity]));

  const items: HeldItem[] = [];
  const problems: HeldItem[] = [];
  const keep: number[] = [];

  for (const line of lines) {
    const inv = byCode.get(line.niceCode);
    if (!inv) continue;

    const available = Math.max(0, inv.stock - (othersByProduct.get(inv.productId) ?? 0));
    const held = inv.isVisible ? Math.min(line.quantity, available) : 0;

    const entry: HeldItem = {
      productId: inv.productId,
      niceCode: inv.niceCode,
      name: inv.name,
      requested: line.quantity,
      held,
      available,
    };
    items.push(entry);
    if (held < line.quantity) problems.push(entry);

    if (held > 0) {
      keep.push(inv.productId);
      await db
        .insert(schema.stockReservations)
        .values({
          sellerId,
          productId: inv.productId,
          quantity: held,
          visitorId,
          source: "cart",
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [
            schema.stockReservations.sellerId,
            schema.stockReservations.productId,
            schema.stockReservations.visitorId,
          ],
          set: { quantity: held, expiresAt, source: "cart" },
          // Nunca degradar una reserva de pedido a una de carrito. Si esta
          // persona ya mando su pedido y vuelve a poner la misma pieza en el
          // carrito, su apartado de un dia no debe encogerse a quince minutos.
          setWhere: eq(schema.stockReservations.source, "cart"),
        });
    }
  }

  /**
   * Lo que ya no esta en el carrito se suelta enseguida.
   *
   * Si solo se dejara vencer, alguien que se arrepiente de una pieza la
   * mantendria bloqueada un cuarto de hora despues de haberla quitado — que es
   * justo el rato en el que otra clienta la esta buscando. Las reservas ligadas
   * a un pedido no se tocan: esas ya no dependen del carrito.
   */
  await db
    .delete(schema.stockReservations)
    .where(
      and(
        eq(schema.stockReservations.sellerId, sellerId),
        eq(schema.stockReservations.visitorId, visitorId),
        eq(schema.stockReservations.source, "cart"),
        keep.length > 0
          ? sql`${schema.stockReservations.productId} not in (${sql.join(
              keep.map((id) => sql`${id}`),
              sql`, `
            )})`
          : sql`1 = 1`
      )
    );

  return { expiresAt, items, problems };
}

/** Suelta todo lo que este visitante tenga apartado en esta tienda. */
export async function releaseCartHolds(sellerId: number, visitorId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.stockReservations)
    .where(
      and(
        eq(schema.stockReservations.sellerId, sellerId),
        eq(schema.stockReservations.visitorId, visitorId),
        eq(schema.stockReservations.source, "cart")
      )
    );
}

/**
 * Convierte las reservas de un carrito en reservas de pedido.
 *
 * A partir de aqui la pieza esta retenida un dia y ya no depende de que el
 * navegador siga abierto: hay un pedido con folio y una conversacion de
 * WhatsApp del otro lado.
 */
export async function holdForOrder(
  sellerId: number,
  visitorId: string,
  orderId: number,
  lines: { productId: number; quantity: number }[]
): Promise<void> {
  const db = await getDb();
  const expiresAt = isoIn(ORDER_HOLD_HOURS * 3_600_000);

  for (const line of lines) {
    await db
      .insert(schema.stockReservations)
      .values({
        sellerId,
        productId: line.productId,
        quantity: line.quantity,
        visitorId,
        source: "order",
        orderId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          schema.stockReservations.sellerId,
          schema.stockReservations.productId,
          schema.stockReservations.visitorId,
        ],
        set: { quantity: line.quantity, expiresAt, source: "order", orderId },
      });
  }
}

/**
 * Suelta las reservas de un pedido.
 *
 * Se llama cuando el pedido se convirtio en venta —ahi el stock ya bajo de
 * verdad y seguir reteniendo seria descontar dos veces— y cuando se cancela.
 */
export async function releaseOrderHolds(orderId: number): Promise<void> {
  const db = await getDb();
  await db.delete(schema.stockReservations).where(eq(schema.stockReservations.orderId, orderId));
}

/**
 * Borra reservas vencidas. No hace falta para que las cuentas salgan —las
 * consultas ya las ignoran— pero evita que la tabla crezca para siempre. Se
 * llama de pasada desde el endpoint que aparta, que es el que mas corre.
 */
export async function sweepExpired(): Promise<void> {
  const db = await getDb();
  // Un margen de una hora: borrar justo al vencer no aporta nada y complica
  // depurar por que una pieza se solto.
  const cutoff = new Date(Date.now() - 3_600_000).toISOString();
  await db.delete(schema.stockReservations).where(lt(schema.stockReservations.expiresAt, cutoff));
}

/** Lo que esta apartado ahora mismo en una tienda, para el panel. */
export async function countActiveHolds(sellerId: number): Promise<Map<number, number>> {
  const db = await getDb();
  const now = new Date().toISOString();

  const rows = await db
    .select({
      productId: schema.stockReservations.productId,
      quantity: sql<number>`coalesce(sum(${schema.stockReservations.quantity}), 0)`,
    })
    .from(schema.stockReservations)
    .where(
      and(
        eq(schema.stockReservations.sellerId, sellerId),
        gt(schema.stockReservations.expiresAt, now)
      )
    )
    .groupBy(schema.stockReservations.productId);

  return new Map(rows.map((r) => [r.productId, r.quantity]));
}
