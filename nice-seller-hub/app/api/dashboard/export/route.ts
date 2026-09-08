import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSeller } from "@/lib/session";
import { listCustomers, listInventory, listOrders, rangeStart } from "@/lib/seller";
import { PAYMENT_LABEL } from "@/lib/payments";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { marginPct } from "@/lib/costing";
import { buildCsv, csvFilename, csvResponse, dateTime, money, type CsvValue } from "@/lib/csv";

/**
 * Descargar la informacion para abrirla en Excel.
 *
 * Todo lo que sale de aqui pasa por `requireSeller()` y se acota con ese
 * `sellerId`. Es la misma regla del resto del panel, y aqui importa el doble:
 * un archivo descargado se reenvia por WhatsApp sin pensarlo, asi que jamas
 * debe poder contener el negocio de otra distribuidora.
 *
 * El rango va en la URL (`?rango=30d`) y solo acepta los mismos que ya usan
 * las pantallas; cualquier otra cosa cae en el de siempre.
 */

export const dynamic = "force-dynamic";

type Sheet = { headers: string[]; rows: CsvValue[][] };

export async function GET(req: Request) {
  let seller;
  try {
    ({ seller } = await requireSeller());
  } catch {
    return new Response("Necesitas iniciar sesión.", { status: 401 });
  }

  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") ?? "ventas";
  const since = rangeStart(url.searchParams.get("rango") ?? "30d");

  let sheet: Sheet;

  switch (tipo) {
    case "inventario":
      sheet = await inventarioSheet(seller.id);
      break;
    case "clientes":
      sheet = await clientesSheet(seller.id);
      break;
    case "pedidos":
      sheet = await pedidosSheet(seller.id);
      break;
    case "abonos":
      sheet = await abonosSheet(seller.id);
      break;
    case "ventas":
    default:
      sheet = await ventasSheet(seller.id, since);
      break;
  }

  const kind = ["inventario", "clientes", "pedidos", "abonos"].includes(tipo) ? tipo : "ventas";
  return csvResponse(
    buildCsv(sheet.headers, sheet.rows),
    csvFilename(seller.slug, kind)
  );
}

/**
 * Ventas, un renglon por pieza vendida.
 *
 * Se exporta por partida y no por venta porque es lo que sirve para trabajar
 * en Excel: con una tabla dinamica sale lo vendido por pieza, por categoria o
 * por mes. Una fila por venta obligaria a abrir cada una para saber que llevo.
 */
async function ventasSheet(sellerId: number, since: string): Promise<Sheet> {
  const db = await getDb();

  const rows = await db
    .select({
      saleId: schema.sales.id,
      createdAt: schema.sales.createdAt,
      status: schema.sales.status,
      paymentMethod: schema.sales.paymentMethod,
      totalCents: schema.sales.totalCents,
      discountCents: schema.sales.discountCents,
      paidCents: schema.sales.paidCents,
      customerName: schema.customers.name,
      name: schema.saleItems.nameSnapshot,
      code: schema.saleItems.codeSnapshot,
      quantity: schema.saleItems.quantity,
      unitPriceCents: schema.saleItems.unitPriceCents,
      unitCostCents: schema.saleItems.unitCostCents,
      subtotalCents: schema.saleItems.subtotalCents,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.sales.customerId))
    .where(and(eq(schema.sales.sellerId, sellerId), gte(schema.sales.createdAt, since)))
    .orderBy(desc(schema.sales.createdAt));

  return {
    headers: [
      "Venta",
      "Fecha",
      "Estado",
      "Cliente",
      "Pieza",
      "Código NICE",
      "Cantidad",
      "Precio unitario",
      "Costo unitario",
      "Importe",
      "Ganancia",
      "Forma de pago",
      "Descuento cupón",
      "Total de la venta",
      "Abonado",
      "Saldo",
    ],
    rows: rows.map((r) => {
      const profit =
        r.unitCostCents === null ? null : (r.unitPriceCents - r.unitCostCents) * r.quantity;
      return [
        r.saleId,
        dateTime(r.createdAt),
        ESTADO_VENTA[r.status] ?? r.status,
        r.customerName ?? "Mostrador",
        r.name,
        r.code,
        r.quantity,
        money(r.unitPriceCents),
        money(r.unitCostCents),
        money(r.subtotalCents),
        money(profit),
        PAYMENT_LABEL[r.paymentMethod] ?? r.paymentMethod,
        money(r.discountCents),
        money(r.totalCents),
        money(r.paidCents),
        money(Math.max(0, r.totalCents - r.paidCents)),
      ];
    }),
  };
}

async function inventarioSheet(sellerId: number): Promise<Sheet> {
  const items = await listInventory(sellerId);

  return {
    headers: [
      "Código NICE",
      "Pieza",
      "Categoría",
      "Existencias",
      "Mi costo",
      "Precio catálogo NICE",
      "Mi precio",
      "Ganancia por pieza",
      "Margen %",
      "Invertido",
      "Valor a mi precio",
      "Visible en la tienda",
    ],
    rows: items.map((i) => [
      i.niceCode,
      i.name,
      i.categoryName ?? "",
      i.stock,
      money(i.costCents),
      money(i.catalogPriceCents),
      money(i.priceCents),
      money(i.costCents === null ? null : i.priceCents - i.costCents),
      marginPct(i.priceCents, i.costCents) ?? "",
      money(i.costCents === null ? null : i.costCents * i.stock),
      money(i.priceCents * i.stock),
      i.isVisible ? "Sí" : "No",
    ]),
  };
}

async function clientesSheet(sellerId: number): Promise<Sheet> {
  const customers = await listCustomers(sellerId);

  return {
    headers: [
      "Cliente",
      "Teléfono",
      "Correo",
      "Compras",
      "Total gastado",
      "Puntos disponibles",
      "Puntos acumulados",
      "Última compra",
    ],
    rows: customers.map((c) => [
      c.name,
      // El telefono va como texto: sin esto Excel se come el signo y los ceros
      // a la izquierda y "+52 1 656..." termina en notacion cientifica.
      `+${c.phone}`,
      c.email ?? "",
      c.purchases,
      money(c.spentCents),
      c.points,
      c.lifetimePoints,
      c.lastPurchase ? dateTime(c.lastPurchase) : "",
    ]),
  };
}

async function pedidosSheet(sellerId: number): Promise<Sheet> {
  const orders = await listOrders(sellerId);

  return {
    headers: ["Folio", "Fecha", "Estado", "Cliente", "Teléfono", "Piezas", "Total"],
    rows: orders.map((o) => [
      o.orderNumber,
      dateTime(o.createdAt),
      ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status,
      o.contactName ?? "",
      o.contactPhone ? `+${o.contactPhone}` : "",
      o.itemCount,
      money(o.totalCents),
    ]),
  };
}

/** Los abonos, uno por renglon, con el saldo de su venta. */
async function abonosSheet(sellerId: number): Promise<Sheet> {
  const db = await getDb();

  const payments = await db
    .select({
      saleId: schema.salePayments.saleId,
      createdAt: schema.salePayments.createdAt,
      amountCents: schema.salePayments.amountCents,
      method: schema.salePayments.method,
      note: schema.salePayments.note,
      customerName: schema.customers.name,
      customerPhone: schema.customers.phone,
      totalCents: schema.sales.totalCents,
      paidCents: schema.sales.paidCents,
      status: schema.sales.status,
      dueDate: schema.sales.dueDate,
    })
    .from(schema.salePayments)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.salePayments.saleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.sales.customerId))
    .where(eq(schema.salePayments.sellerId, sellerId))
    .orderBy(desc(schema.salePayments.createdAt));

  return {
    headers: [
      "Venta",
      "Fecha del abono",
      "Cliente",
      "Teléfono",
      "Abono",
      "Forma de pago",
      "Nota",
      "Total de la venta",
      "Abonado en total",
      "Saldo",
      "Estado",
      "Fecha límite",
    ],
    rows: payments.map((p) => [
      p.saleId,
      dateTime(p.createdAt),
      p.customerName ?? "Mostrador",
      p.customerPhone ? `+${p.customerPhone}` : "",
      money(p.amountCents),
      PAYMENT_LABEL[p.method] ?? p.method,
      p.note ?? "",
      money(p.totalCents),
      money(p.paidCents),
      money(Math.max(0, p.totalCents - p.paidCents)),
      ESTADO_VENTA[p.status] ?? p.status,
      p.dueDate ?? "",
    ]),
  };
}

const ESTADO_VENTA: Record<string, string> = {
  paid: "Pagada",
  partial: "A abonos",
  cancelled: "Cancelada",
};
