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
    /**
     * La linea que va debajo del nombre de la tienda.
     *
     * Antes decia "Distribuidora NICE" a fuerza, para todas. Eso daba por
     * hecho que quien usa esto vende NICE, y ademas le ponia a su tienda una
     * marca que no es suya. Ahora lo escribe ella: "Distribuidora NICE",
     * "Joyeria Mayela" o nada.
     */
    tagline: text("tagline"),
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
    /**
     * Los mensajes de WhatsApp que arma el sistema, a su manera de escribir.
     *
     * Nulo = usa el texto por omision (`lib/message-templates.ts`). Guardar
     * nulo y no el texto por omision copiado es lo que permite que, si algun
     * dia se mejora la redaccion por defecto, quien nunca lo toco se beneficie
     * solo — y quien si lo personalizo conserva exactamente lo suyo.
     *
     * Solo la parte de "voz" es editable; los renglones con precios, folio y
     * totales del pedido son siempre los mismos, calculados por el sistema:
     * eso es dinero, y ahi no hay redaccion que valga mas que la exactitud.
     */
    orderGreetingTemplate: text("order_greeting_template"),
    orderClosingTemplate: text("order_closing_template"),
    shareMessageTemplate: text("share_message_template"),
    paymentReminderTemplate: text("payment_reminder_template"),
    couponMessageTemplate: text("coupon_message_template"),
    pointsGreetingTemplate: text("points_greeting_template"),
    pointsClosingTemplate: text("points_closing_template"),

    /**
     * El descuento con el que ella le compra a NICE, en porcentaje entero.
     * De aqui sale el costo estimado de cada pieza: catalogo x (1 - d). Se
     * guarda como porcentaje y no como factor porque es el numero que ella
     * conoce y dice ("tengo el 30").
     */
    distributorDiscountPct: integer("distributor_discount_pct").notNull().default(0),
    deliveryMethods: text("delivery_methods"),
    paymentMethods: text("payment_methods"),
    /** "active" | "suspended" — solo el admin la cambia. */
    status: text("status").notNull().default("active"),
    /**
     * Lo que ESTA distribuidora te paga a ti por usar el sistema — no tiene
     * nada que ver con lo que ella les cobra a sus clientas.
     *
     * "trial" | "active" | "overdue" | "cancelled". Se cambia solo a mano,
     * desde /admin/sellers: aqui no hay cobro automatico, es el admin quien
     * decide y quien marca cuando alguien le pagó.
     */
    planStatus: text("plan_status").notNull().default("trial"),
    /** Lo que le cobras al mes, en centavos. 0 = todavia no se ha fijado. */
    planPriceCents: integer("plan_price_cents").notNull().default(0),
    /** Fecha (ISO, solo dia) hasta la que tiene pagado. Null = nunca pagó. */
    planPaidUntil: text("plan_paid_until"),
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
    /**
     * Precio de lista del catalogo, en centavos. Es una sugerencia: al recibir
     * mercancia se usa para prellenar el precio de la distribuidora, que sigue
     * siendo suyo y editable. El precio con el que se vende vive en
     * seller_inventory, no aqui.
     */
    suggestedPriceCents: integer("suggested_price_cents"),
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
    /**
     * Lo que le costo la pieza, en centavos. Nullable a proposito: el
     * inventario que ya existia se cargo sin costo, y un 0 seria una mentira
     * —diria que le salio gratis— mientras que un nulo dice la verdad, que no
     * se sabe. Todos los calculos de ganancia lo tratan como desconocido y lo
     * reportan aparte.
     */
    costCents: integer("cost_cents"),
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
    /** Lo que descuenta el cupon del club, si la clienta aplico uno. */
    discountCents: integer("discount_cents").notNull().default(0),
    /** El cupon aplicado. Se guarda el codigo, no el id: es lo que se lee. */
    redemptionCode: text("redemption_code"),
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
    /**
     * paid | partial | cancelled
     *
     * "partial" es una venta a abonos: la pieza ya salio del inventario —esta
     * apartada, nadie mas se la puede llevar— pero todavia no esta pagada.
     * "cancelled" devuelve las piezas al inventario.
     */
    status: text("status").notNull().default("paid"),
    /** Lo abonado hasta ahora. En una venta de contado es igual al total. */
    paidCents: integer("paid_cents").notNull().default(0),
    /** Fecha limite acordada para terminar de pagar. Solo informativa. */
    dueDate: text("due_date"),
    /**
     * Los puntos que ya se otorgaron por esta venta. Se guarda para no darlos
     * dos veces: en una venta a abonos los puntos llegan al quedar pagada, y
     * ese momento puede ocurrir en cualquier abono.
     */
    pointsAwarded: integer("points_awarded").notNull().default(0),
    /**
     * Lo que descontó el cupón del club. El total ya viene con el descuento
     * aplicado: es lo que la clienta pagó de verdad, y por eso es tambien la
     * base sobre la que se acumulan los puntos de esta compra.
     */
    discountCents: integer("discount_cents").notNull().default(0),
    redemptionCode: text("redemption_code"),
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
    /**
     * El costo unitario al momento de vender. Se copia igual que el precio: si
     * el mes que entra ella recibe la misma pieza mas cara, la ganancia de la
     * venta de hoy tiene que seguir calculandose con lo que le costo hoy.
     */
    unitCostCents: integer("unit_cost_cents"),
    subtotalCents: integer("subtotal_cents").notNull(),
  },
  (t) => ({
    saleIdx: index("sale_items_sale_idx").on(t.saleId),
  })
);

/**
 * Un abono.
 *
 * Se guarda cada pago por separado y nunca se edita el acumulado a mano: el
 * saldo es la resta entre el total y la suma de los abonos, asi que siempre se
 * puede reconstruir de donde salio cada peso. Una clienta que pregunta "cuanto
 * llevo" merece una respuesta que se pueda demostrar.
 */
export const salePayments = sqliteTable(
  "sale_payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    /** efectivo | transferencia | tarjeta | otro */
    method: text("method").notNull().default("efectivo"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    saleIdx: index("sale_payments_sale_idx").on(t.saleId, t.createdAt),
    sellerIdx: index("sale_payments_seller_idx").on(t.sellerId, t.createdAt),
  })
);

// --- Lealtad ---------------------------------------------------------------
//
// Cada distribuidora lleva su propio programa: sus reglas, sus recompensas y
// sus clientas. No hay una bolsa global de puntos — los puntos que alguien
// junto con Ana no valen nada con Maria, igual que en la vida real.

/**
 * Las reglas del programa de una distribuidora. Existe una fila por tienda y
 * se crea sola con valores razonables la primera vez que se consulta: asi
 * ninguna pantalla tiene que lidiar con "todavia no hay configuracion".
 */
export const loyaltyPrograms = sqliteTable(
  "loyalty_programs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    /** Apagado por omision: nadie deberia estrenar un programa sin haberlo leido. */
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    /** Como se llama el club en su tienda. */
    name: text("name").notNull().default("Club de puntos"),
    /**
     * Cuantos centavos de compra valen un punto. 1000 = 1 punto por cada $10.
     * Se guarda asi, y no como "puntos por peso", porque en enteros no hay
     * forma de escribir 0.1 sin perder precision al acumular.
     */
    centsPerPoint: integer("cents_per_point").notNull().default(1000),
    /** Puntos de bienvenida al registrarse. 0 = ninguno. */
    welcomePoints: integer("welcome_points").notNull().default(0),
    /** Texto libre con las condiciones que ella quiera poner. */
    terms: text("terms"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    sellerIdx: uniqueIndex("loyalty_programs_seller_idx").on(t.sellerId),
  })
);

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
    /** Saldo disponible: lo ganado menos lo canjeado. */
    points: integer("points").notNull().default(0),
    /** Acumulado historico, nunca baja. Es lo que define el nivel. */
    lifetimePoints: integer("lifetime_points").notNull().default(0),
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
    /** "earn" | "redeem" | "adjust" | "welcome" */
    type: text("type").notNull(),
    /** Positivo suma, negativo resta. */
    points: integer("points").notNull(),
    description: text("description"),
    referenceId: integer("reference_id"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    accountIdx: index("loyalty_tx_account_idx").on(t.accountId, t.createdAt),
  })
);

/**
 * Una recompensa es lo que la distribuidora ofrece a cambio de puntos. Las
 * define ella, en su panel, y solo aplican en su tienda.
 */
export const loyaltyRewards = sqliteTable(
  "loyalty_rewards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    pointsCost: integer("points_cost").notNull(),
    /** "percent" (% de descuento) | "amount" (pesos) | "gift" (regalo o envio) */
    kind: text("kind").notNull().default("percent"),
    /** 15 = 15%. En "amount", centavos. En "gift" no se usa. */
    value: integer("value").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    sellerIdx: index("loyalty_rewards_seller_idx").on(t.sellerId, t.position),
  })
);

/**
 * Un cupon ya canjeado.
 *
 * Los datos de la recompensa se copian al canjear: si manana ella cambia el
 * descuento de 10% a 5%, el cupon que alguien ya tiene en la mano tiene que
 * seguir valiendo el 10% que se le prometio.
 *
 * El codigo es lo que la clienta enseña por WhatsApp y lo que la distribuidora
 * busca en su panel para marcarlo como usado.
 */
export const loyaltyRedemptions = sqliteTable(
  "loyalty_redemptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    rewardId: integer("reward_id"),
    code: text("code").notNull(),
    pointsSpent: integer("points_spent").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    kind: text("kind").notNull(),
    value: integer("value").notNull().default(0),
    /** available | used | cancelled */
    status: text("status").notNull().default("available"),
    /** El pedido en el que se aplico, si se aplico en uno. */
    orderId: integer("order_id"),
    createdAt: text("created_at").notNull().default(now),
    usedAt: text("used_at"),
  },
  (t) => ({
    codeIdx: uniqueIndex("loyalty_redemptions_code_idx").on(t.code),
    sellerIdx: index("loyalty_redemptions_seller_idx").on(t.sellerId, t.createdAt),
    customerIdx: index("loyalty_redemptions_customer_idx").on(t.customerId),
  })
);

// --- Recepcion de mercancia -------------------------------------------------

/**
 * Una recepcion es lo que la distribuidora acaba de recibir de NICE, leido de
 * la foto de su ticket.
 *
 * Nace SIEMPRE en `draft` y no toca el inventario hasta que ella confirma. El
 * OCR se equivoca —tickets termicos borrosos, digitos que se parecen— y un
 * inventario mal cargado es peor que no tener la funcion: lo que se publica en
 * la tienda deja de ser cierto.
 *
 * La foto del ticket no se guarda. Una vez extraidos los codigos ya no aporta
 * nada, y guardar fotos de tickets es un costo y una responsabilidad que este
 * producto no necesita.
 */
export const receptions = sqliteTable(
  "receptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    /** draft | confirmed | cancelled */
    status: text("status").notNull().default("draft"),
    /** photo | manual */
    source: text("source").notNull().default("photo"),
    /**
     * El "TOTAL ARTICULOS" impreso en el ticket. Sirve de verificación: si la
     * suma de las cantidades no cuadra con este número, el OCR se saltó un
     * renglón y hay que avisarlo antes de cargar nada.
     */
    declaredItems: integer("declared_items"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
    confirmedAt: text("confirmed_at"),
  },
  (t) => ({
    sellerIdx: index("receptions_seller_idx").on(t.sellerId, t.createdAt),
  })
);

export const receptionItems = sqliteTable(
  "reception_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    receptionId: integer("reception_id")
      .notNull()
      .references(() => receptions.id, { onDelete: "cascade" }),
    /** El codigo tal como quedo tras la revision de la persona. */
    niceCode: text("nice_code").notNull(),
    quantity: integer("quantity").notNull().default(1),
    /** Nulo mientras el codigo no exista en el catalogo global. */
    productId: integer("product_id").references(() => products.id),
    /** Precio al que ella lo va a vender. Se prellena, se puede cambiar. */
    priceCents: integer("price_cents"),
    /** Lo que le costo, ya con su descuento de distribuidora aplicado. */
    costCents: integer("cost_cents"),
    /**
     * El "Precio Catálogo" impreso en el ticket, en centavos. Es la mejor
     * sugerencia que existe para una pieza que todavia no esta en el catalogo
     * global: viene de NICE, en el papel que ella tiene en la mano.
     */
    catalogPriceCents: integer("catalog_price_cents"),
    /**
     * La descripcion del ticket ("ARETES"). En los tickets de NICE va en el
     * renglon de abajo del codigo. Prellena el alta de una pieza nueva para
     * que no haya que escribirla desde cero.
     */
    nameHint: text("name_hint"),
    /** matched | not_found | skipped */
    status: text("status").notNull().default("matched"),
    /** El renglon crudo que leyo el OCR, para poder cotejarlo con el ticket. */
    rawLine: text("raw_line"),
    /** high | low — si es low, la interfaz pide revisarlo con cuidado. */
    confidence: text("confidence").notNull().default("high"),
  },
  (t) => ({
    receptionIdx: index("reception_items_reception_idx").on(t.receptionId),
  })
);

// --- Apartado temporal ------------------------------------------------------

/**
 * Una pieza retenida mientras alguien la esta comprando.
 *
 * El problema que resuelve es concreto: dos clientas abren la tienda el mismo
 * sabado, las dos ven "queda 1", las dos mandan su pedido por WhatsApp y una de
 * las dos se va a quedar sin nada. El inventario decia la verdad en los dos
 * momentos; lo que faltaba era que la primera en tomarla la retuviera.
 *
 * Una reserva NO baja las existencias. El stock sigue siendo el numero de
 * piezas que ella tiene fisicamente en su casa; lo que cambia es cuantas estan
 * *disponibles para alguien mas*. Si bajara el stock, un carrito abandonado se
 * veria en el panel como mercancia que se esfumo.
 *
 * Y siempre vence. Un apartado sin vencimiento es una pieza perdida: nadie va
 * a volver a abrir ese carrito y nadie mas la va a poder comprar.
 */
export const stockReservations = sqliteTable(
  "stock_reservations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    /**
     * Quien la tiene apartada: un identificador opaco del navegador, guardado
     * en una cookie. No dice quien es la persona y no hace falta que lo diga —
     * solo tiene que distinguir "yo" de "alguien mas".
     *
     * Alguien que borre su cookie pierde sus propias reservas; no gana las de
     * nadie. Ese es el peor caso y es aceptable.
     */
    visitorId: text("visitor_id").notNull(),
    /** cart | order — el pedido ya mandado aguanta mucho mas que un carrito. */
    source: text("source").notNull().default("cart"),
    orderId: integer("order_id"),
    createdAt: text("created_at").notNull().default(now),
    /**
     * Cuando deja de valer, en ISO. Las consultas filtran por esta columna, asi
     * que una reserva vencida deja de contar sola: no hace falta un proceso que
     * corra a limpiarlas para que la tienda diga la verdad.
     */
    expiresAt: text("expires_at").notNull(),
  },
  (t) => ({
    // Una fila por visitante y pieza en cada tienda: renovar es un UPDATE, no
    // una fila mas cada vez que alguien recarga el carrito.
    uniqueIdx: uniqueIndex("stock_reservations_unique_idx").on(
      t.sellerId,
      t.productId,
      t.visitorId
    ),
    lookupIdx: index("stock_reservations_lookup_idx").on(
      t.sellerId,
      t.productId,
      t.expiresAt
    ),
    visitorIdx: index("stock_reservations_visitor_idx").on(t.visitorId),
    orderIdx: index("stock_reservations_order_idx").on(t.orderId),
  })
);

// --- Recuperacion de contraseña ---------------------------------------------

/**
 * Un enlace de un solo uso para volver a poner una contraseña.
 *
 * Todavia no hay correo saliente, asi que no puede haber un "olvide mi
 * contraseña" que se resuelva solo. Lo que si puede haber —y es lo que hace la
 * diferencia entre operar y no operar— es que quien administra la plataforma
 * genere el enlace desde el panel y se lo mande por WhatsApp, en vez de tener
 * que correr un script desde su computadora un domingo en la noche.
 *
 * Del token se guarda solo su huella SHA-256. Si alguien llegara a leer esta
 * tabla, no obtiene ningun enlace utilizable — igual que con las contraseñas.
 */
export const passwordResets = sqliteTable(
  "password_resets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 del token en hexadecimal. El token en claro no se guarda. */
    tokenHash: text("token_hash").notNull(),
    /** Quien lo genero. Hoy siempre un admin. */
    createdBy: integer("created_by"),
    createdAt: text("created_at").notNull().default(now),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
  },
  (t) => ({
    hashIdx: uniqueIndex("password_resets_hash_idx").on(t.tokenHash),
    userIdx: index("password_resets_user_idx").on(t.userId, t.createdAt),
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
export type SalePayment = typeof salePayments.$inferSelect;
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRedemption = typeof loyaltyRedemptions.$inferSelect;
export type StockReservation = typeof stockReservations.$inferSelect;
export type Reception = typeof receptions.$inferSelect;
export type ReceptionItem = typeof receptionItems.$inferSelect;
