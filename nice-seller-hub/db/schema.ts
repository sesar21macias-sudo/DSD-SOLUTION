import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Convenciones de este esquema:
 *
 * - El dinero se guarda SIEMPRE en centavos, como entero. Un peso con
 *   decimales flotantes acaba en totales que no cuadran con la suma de sus
 *   partidas, y aqui esos totales se le mandan por WhatsApp a un cliente.
 * - Las fechas se guardan como texto ISO-8601 en UTC. SQLite no tiene tipo
 *   fecha; el texto ISO ordena alfabeticamente igual que cronologicamente.
 * - Todo lo que pertenece a una distribuidora lleva `sellerId` y esta indexado
 *   por esa columna: es la llave del aislamiento entre tiendas.
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

// --- Cuentas y roles -------------------------------------------------------

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    /** "admin" | "seller". El rol vive en la sesion firmada, no en el cliente. */
    role: text("role").notNull().default("seller"),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    /**
     * Se guarda con cada usuario para poder subir el costo del hash mas
     * adelante sin dejar fuera a las cuentas viejas.
     */
    passwordIterations: integer("password_iterations").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

export const sellers = sqliteTable(
  "sellers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** El identificador de la tienda publica: nicehub.com/{slug} */
    slug: text("slug").notNull(),
    businessName: text("business_name").notNull(),
    profileImage: text("profile_image"),
    coverImage: text("cover_image"),
    description: text("description"),
    city: text("city"),
    state: text("state"),
    /**
     * En formato internacional, solo digitos: 5216561234567.
     * Guardarlo normalizado es lo que hace que el enlace wa.me funcione igual
     * desde un iPhone, desde Android y desde WhatsApp Web.
     */
    whatsapp: text("whatsapp").notNull(),
    instagram: text("instagram"),
    facebook: text("facebook"),
    schedule: text("schedule"),
    deliveryMethods: text("delivery_methods"),
    paymentMethods: text("payment_methods"),
    /** "active" | "suspended" — solo el admin la cambia. */
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    slugIdx: uniqueIndex("sellers_slug_idx").on(t.slug),
    userIdx: uniqueIndex("sellers_user_idx").on(t.userId),
  })
);

// --- Catalogo global -------------------------------------------------------

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    image: text("image"),
    position: integer("position").notNull().default(0),
    status: text("status").notNull().default("active"),
  },
  (t) => ({
    slugIdx: uniqueIndex("categories_slug_idx").on(t.slug),
  })
);

/**
 * El producto global describe la pieza (que es, como se ve, de que material).
 * NO tiene precio ni existencias: eso pertenece a cada distribuidora. Es la
 * separacion mas importante del modelo — el mismo collar 826031 puede costar
 * distinto y estar agotado o no dependiendo de con quien lo compres.
 */
export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    niceCode: text("nice_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    categoryId: integer("category_id").references(() => categories.id),
    material: text("material"),
    finish: text("finish"),
    imageUrl: text("image_url"),
    /** Imagenes adicionales, JSON: ["url", ...]. */
    gallery: text("gallery"),
    /**
     * Quien dio de alta la pieza. null = catalogo oficial. Sirve para que el
     * admin distinga lo curado de lo que subio una distribuidora.
     */
    createdBySellerId: integer("created_by_seller_id"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    codeIdx: uniqueIndex("products_nice_code_idx").on(t.niceCode),
    categoryIdx: index("products_category_idx").on(t.categoryId),
  })
);

// --- Inventario de cada distribuidora --------------------------------------

export const sellerInventory = sqliteTable(
  "seller_inventory",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    stock: integer("stock").notNull().default(0),
    /**
     * "Disponible / Ultimas piezas / Agotado" NO se guardan: se derivan del
     * stock y se calcularian mal en cuanto alguien registre una venta sin
     * acordarse de actualizar el estado. Lo unico que decide la persona es si
     * la pieza se ve o no.
     */
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    sellerProductIdx: uniqueIndex("seller_inventory_seller_product_idx").on(
      t.sellerId,
      t.productId
    ),
    sellerIdx: index("seller_inventory_seller_idx").on(t.sellerId),
  })
);

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    /** "add" | "increase" | "decrease" | "sale" | "remove" | "hide" | "show" */
    type: text("type").notNull(),
    delta: integer("delta").notNull().default(0),
    stockBefore: integer("stock_before").notNull().default(0),
    stockAfter: integer("stock_after").notNull().default(0),
    reason: text("reason"),
    referenceId: integer("reference_id"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    sellerIdx: index("inventory_movements_seller_idx").on(t.sellerId, t.createdAt),
  })
);

// --- Clientes --------------------------------------------------------------

/**
 * El cliente es una persona, identificada por su telefono. Puede comprarle a
 * mas de una distribuidora, y por eso la relacion vive aparte: ninguna
 * distribuidora ve la cartera de la otra.
 */
export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    phoneIdx: uniqueIndex("customers_phone_idx").on(t.phone),
  })
);

export const sellerCustomers = sqliteTable(
  "seller_customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    pairIdx: uniqueIndex("seller_customers_pair_idx").on(t.sellerId, t.customerId),
    sellerIdx: index("seller_customers_seller_idx").on(t.sellerId),
  })
);

// --- Pedidos (lo que llega por WhatsApp) -----------------------------------

/**
 * Un pedido NO descuenta existencias. Es una intencion de compra que todavia
 * tiene que confirmarse por WhatsApp; si descontara, cualquiera podria dejar
 * en ceros el inventario de una distribuidora sin comprar nada.
 * El stock se mueve cuando se registra la venta.
 */
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    /** Nulo cuando el pedido se hizo como invitado. */
    customerId: integer("customer_id").references(() => customers.id),
    orderNumber: text("order_number").notNull(),
    /** pending | whatsapp_sent | confirmed | preparing | delivered | cancelled */
    status: text("status").notNull().default("pending"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    note: text("note"),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    numberIdx: uniqueIndex("orders_number_idx").on(t.orderNumber),
    sellerIdx: index("orders_seller_idx").on(t.sellerId, t.createdAt),
  })
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    /**
     * Nombre, codigo y precio se copian al momento del pedido. Si manana la
     * distribuidora sube el precio, el pedido de ayer tiene que seguir
     * diciendo lo que se le prometio al cliente.
     */
    nameSnapshot: text("name_snapshot").notNull(),
    codeSnapshot: text("code_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
  })
);

/**
 * Contador por dia para los folios NICE-YYYYMMDD-NNNN. Un `SELECT count(*)+1`
 * daria folios repetidos si dos clientes confirman en el mismo instante;
 * este contador se incrementa con un UPDATE ... RETURNING, que es atomico.
 */
export const orderCounters = sqliteTable("order_counters", {
  day: text("day").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});

// --- Ventas (lo que si movio dinero y existencias) -------------------------

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customers.id),
    /** Si la venta nacio de un pedido, queda la liga. */
    orderId: integer("order_id").references(() => orders.id),
    totalCents: integer("total_cents").notNull(),
    /** efectivo | transferencia | tarjeta | otro */
    paymentMethod: text("payment_method").notNull().default("efectivo"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    sellerIdx: index("sales_seller_idx").on(t.sellerId, t.createdAt),
  })
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    codeSnapshot: text("code_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
  },
  (t) => ({
    saleIdx: index("sale_items_sale_idx").on(t.saleId),
  })
);

// --- Lealtad ---------------------------------------------------------------
// Las tablas existen desde ahora y los puntos se acumulan con cada venta, para
// que cuando se construya la Fase 2 el historial ya este completo. La interfaz
// de recompensas y cupones todavia no esta hecha.

export const loyaltyAccounts = sqliteTable(
  "loyalty_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    points: integer("points").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    pairIdx: uniqueIndex("loyalty_accounts_pair_idx").on(t.sellerId, t.customerId),
  })
);

export const loyaltyTransactions = sqliteTable(
  "loyalty_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: "cascade" }),
    /** "earn" | "redeem" | "adjust" */
    type: text("type").notNull(),
    points: integer("points").notNull(),
    description: text("description"),
    referenceId: integer("reference_id"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    accountIdx: index("loyalty_tx_account_idx").on(t.accountId, t.createdAt),
  })
);

// --- Limites de uso --------------------------------------------------------

/**
 * Contador por (llave, ventana) para frenar abusos en los endpoints publicos.
 * Vive en D1 y no en memoria porque cada request puede caer en un isolate
 * distinto: un contador en memoria no limita nada en un Worker.
 */
export const rateLimits = sqliteTable("rate_limits", {
  /** "orders:<ip>:<ventana>" */
  key: text("key").primaryKey(),
  hits: integer("hits").notNull().default(0),
  /** Epoch en segundos del inicio de la ventana; sirve para limpiar. */
  windowStart: integer("window_start").notNull(),
});

// --- Configuracion ---------------------------------------------------------

/** Pares llave/valor de la instalacion. Hoy guarda el secreto de sesion. */
export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Seller = typeof sellers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InventoryRow = typeof sellerInventory.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Sale = typeof sales.$inferSelect;
