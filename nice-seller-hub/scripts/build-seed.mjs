import { writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

/**
 * Genera scripts/seed.sql.
 *
 * No escribe stocks y ventas por separado: **simula** el historial. Arranca
 * cada pieza con un inventario inicial, aplica las ventas en orden y va
 * bajando las existencias. Asi el stock que se ve en la tienda, las ventas del
 * panel y el historial de movimientos cuentan la misma historia — que es lo
 * unico que hace util un conjunto de datos de prueba.
 *
 * Uso: node scripts/build-seed.mjs
 */

// Debe coincidir con lib/auth.ts. Cloudflare no admite mas de 100 000.
const PBKDF2_ITERATIONS = 100_000;
const DEMO_PASSWORD = "nicedemo2026";

const enc = new TextEncoder();

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 16) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return hex(bits);
}

/** Generador con semilla fija: el seed sale igual cada vez que se regenera. */
let seedState = 20260906;
function rand() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

function q(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function iso(daysAgo, hour = 12, minute = 0) {
  const d = new Date(Date.UTC(2026, 8, 6, hour, minute, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().replace("Z", "Z").replace(/\.\d{3}Z$/, ".000Z");
}

// --- Imagenes --------------------------------------------------------------

/**
 * Las fotos de las piezas son SVG generados aqui, guardados como data URI.
 *
 * Es a proposito: enlazar fotos de un banco de imagenes externo deja el
 * catalogo lleno de cuadros rotos el dia que esa URL cambia, y una tienda de
 * joyeria con imagenes rotas se ve peor que una con ilustraciones. Cada
 * distribuidora sustituye estas por sus fotos reales desde el panel.
 */
const PALETTES = {
  dorado: ["#FAF0DC", "#E3C88E", "#B08D57"],
  plateado: ["#F4F5F7", "#D6DAE0", "#9AA1AA"],
  rosa: ["#FDECF2", "#F2C6D6", "#C98CA7"],
  negro: ["#EDEDEF", "#C9C9CE", "#6E6E76"],
};

const SHAPES = {
  collar: (c) =>
    `<path d="M100 78 C 148 78 176 118 176 156 C 176 200 142 228 100 228 C 58 228 24 200 24 156 C 24 118 52 78 100 78 Z" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
     <circle cx="100" cy="232" r="17" fill="${c}"/>`,
  aretes: (c) =>
    `<circle cx="68" cy="120" r="32" fill="none" stroke="${c}" stroke-width="6"/>
     <circle cx="132" cy="120" r="32" fill="none" stroke="${c}" stroke-width="6"/>
     <path d="M68 88 v-22 M132 88 v-22" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
     <circle cx="68" cy="60" r="7" fill="${c}"/><circle cx="132" cy="60" r="7" fill="${c}"/>`,
  anillo: (c) =>
    `<circle cx="100" cy="165" r="56" fill="none" stroke="${c}" stroke-width="9"/>
     <path d="M100 76 l22 26 -22 26 -22 -26 Z" fill="${c}"/>`,
  pulsera: (c) =>
    `<ellipse cx="100" cy="150" rx="72" ry="46" fill="none" stroke="${c}" stroke-width="9"/>
     <circle cx="100" cy="104" r="12" fill="${c}"/>
     <circle cx="44" cy="150" r="8" fill="${c}"/><circle cx="156" cy="150" r="8" fill="${c}"/>`,
  dije: (c) =>
    `<path d="M100 92 C 128 60 176 78 176 118 C 176 156 128 184 100 214 C 72 184 24 156 24 118 C 24 78 72 60 100 92 Z" fill="none" stroke="${c}" stroke-width="6"/>
     <circle cx="100" cy="60" r="9" fill="none" stroke="${c}" stroke-width="5"/>`,
  cadena: (c) =>
    `<g fill="none" stroke="${c}" stroke-width="6">
       <ellipse cx="100" cy="72" rx="20" ry="13"/><ellipse cx="100" cy="102" rx="20" ry="13"/>
       <ellipse cx="100" cy="132" rx="20" ry="13"/><ellipse cx="100" cy="162" rx="20" ry="13"/>
       <ellipse cx="100" cy="192" rx="20" ry="13"/><ellipse cx="100" cy="222" rx="20" ry="13"/>
     </g>`,
  set: (c) =>
    `<circle cx="66" cy="96" r="26" fill="none" stroke="${c}" stroke-width="5"/>
     <circle cx="134" cy="96" r="26" fill="none" stroke="${c}" stroke-width="5"/>
     <path d="M100 148 C 140 148 162 176 162 204 C 162 232 134 250 100 250 C 66 250 38 232 38 204 C 38 176 60 148 100 148 Z" fill="none" stroke="${c}" stroke-width="5"/>`,
  charm: (c) =>
    `<circle cx="100" cy="150" r="46" fill="none" stroke="${c}" stroke-width="7"/>
     <path d="M100 118 l10 22 24 3 -18 17 5 24 -21 -12 -21 12 5 -24 -18 -17 24 -3 Z" fill="${c}"/>`,
};

function productImage(shape, palette) {
  const [bg1, bg2, ink] = PALETTES[palette] ?? PALETTES.dorado;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="200" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/>${(SHAPES[shape] ?? SHAPES.dije)(ink)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function avatarImage(letter, palette) {
  const [bg1, bg2, ink] = PALETTES[palette];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#a)"/><text x="100" y="128" font-family="-apple-system,Segoe UI,sans-serif" font-size="86" font-weight="300" fill="${ink}" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// --- Catalogo --------------------------------------------------------------

const CATEGORIES = [
  ["Anillos", "anillos"],
  ["Aretes", "aretes"],
  ["Collares", "collares"],
  ["Pulseras", "pulseras"],
  ["Dijes", "dijes"],
  ["Cadenas", "cadenas"],
  ["Charms", "charms"],
  ["Sets", "sets"],
  ["Caballero", "caballero"],
  ["Infantil", "infantil"],
  ["Especiales", "especiales"],
];

const CAT = Object.fromEntries(CATEGORIES.map(([, slug], i) => [slug, i + 1]));

const PRODUCTS = [
  ["826031", "Collar de eslabones", "collares", "collar", "dorado", "Acero inoxidable", "Dorado", 1099,
   "Eslabones planos con caída suave. La pieza que se lleva todas las miradas sin decir nada."],
  ["526161L", "Aretes de argolla texturizada", "aretes", "aretes", "dorado", "Acero inoxidable", "Dorado", 199,
   "Argollas medianas con textura martillada. Ligeros para traerlos todo el día."],
  ["826035", "Pulsera de eslabón grueso", "pulseras", "pulsera", "dorado", "Acero inoxidable", "Dorado", 599,
   "Eslabón ancho con broche reforzado. Se ve mejor sola que acompañada."],
  ["714208", "Anillo solitario zirconia", "anillos", "anillo", "plateado", "Plata 925", "Plateado", 749,
   "Zirconia de corte brillante en montura de cuatro garras."],
  ["918442", "Dije corazón grabado", "dijes", "dije", "rosa", "Acero inoxidable", "Oro rosa", 349,
   "Corazón liso, listo para grabar una fecha o una inicial."],
  ["632017", "Cadena veneciana 45 cm", "cadenas", "cadena", "plateado", "Plata 925", "Plateado", 899,
   "Tejido veneciano fino. La base perfecta para cualquier dije."],
  ["745901", "Charm mariposa", "charms", "charm", "rosa", "Acero inoxidable", "Oro rosa", 249,
   "Mariposa con esmalte a mano. Compatible con pulseras de charms."],
  ["826088", "Set collar y aretes perla", "sets", "set", "dorado", "Acero inoxidable", "Dorado", 1499,
   "Collar con perla de cristal y aretes a juego. Viene en estuche."],
  ["551230", "Esclava caballero acero", "caballero", "pulsera", "negro", "Acero inoxidable", "Acero", 849,
   "Esclava de eslabón cuadrado con acabado mate."],
  ["551277", "Cadena caballero 55 cm", "caballero", "cadena", "negro", "Acero inoxidable", "Acero", 1199,
   "Tejido barbado de 5 mm. Resistente y con peso."],
  ["330145", "Aretes infantil florecita", "infantil", "aretes", "rosa", "Acero quirúrgico", "Oro rosa", 179,
   "Broquel hipoalergénico con florecita esmaltada."],
  ["826044", "Collar choker minimal", "collares", "collar", "plateado", "Acero inoxidable", "Plateado", 649,
   "Choker liso de 38 cm con extensión. Va con todo."],
  ["714233", "Anillo entrelazado", "anillos", "anillo", "dorado", "Acero inoxidable", "Dorado", 429,
   "Dos bandas entrelazadas en un solo anillo."],
  ["526188", "Aretes largos con caída", "aretes", "aretes", "dorado", "Latón chapado", "Dorado", 389,
   "Caída de 6 cm. Para cuando la ocasión lo pide."],
  ["918477", "Dije inicial personalizable", "dijes", "dije", "dorado", "Acero inoxidable", "Dorado", 299,
   "Letra en relieve. Elige la inicial al hacer el pedido."],
  ["826099", "Pulsera de perlas cultivadas", "pulseras", "pulsera", "plateado", "Perla cultivada", "Plateado", 1299,
   "Perlas de agua dulce con broche de plata."],
  ["745933", "Charm estrella brillante", "charms", "charm", "plateado", "Plata 925", "Plateado", 279,
   "Estrella con micro zirconias engastadas."],
  ["990120", "Set novia tres piezas", "especiales", "set", "plateado", "Plata 925", "Plateado", 2499,
   "Collar, aretes y pulsera. Edición limitada de temporada."],
  ["632055", "Cadena figaro 50 cm", "cadenas", "cadena", "dorado", "Acero inoxidable", "Dorado", 799,
   "Tejido figaro clásico, 3 mm."],
  ["714260", "Anillo banda martillada", "anillos", "anillo", "negro", "Acero inoxidable", "Acero", 359,
   "Banda de 6 mm con textura martillada a mano."],

  /**
   * Estas cinco vienen de un ticket real de NICE (orden PD38-4944698). Los
   * códigos y los precios son los impresos; el nombre es la descripción que
   * trae el ticket —"ARETES"— sin adornar: inventarles una descripción de
   * catálogo sería poner en boca de NICE algo que NICE no dijo.
   *
   * A propósito NO están en el inventario de nadie: son las piezas que llegan
   * al escanear ese ticket, y así el flujo de recepción se ve completo.
   */
  ["925094L", "Aretes", "aretes", "aretes", "dorado", null, null, 319, null],
  ["925181", "Aretes", "aretes", "aretes", "plateado", null, null, 279, null],
  ["925485L", "Aretes", "aretes", "aretes", "rosa", null, null, 249, null],
  ["925636L", "Aretes", "aretes", "aretes", "dorado", null, null, 319, null],
  ["925655L", "Aretes", "aretes", "aretes", "plateado", null, null, 259, null],
];

// --- Distribuidoras --------------------------------------------------------

const SELLERS = [
  {
    name: "Ana García",
    email: "ana@nicehub.mx",
    slug: "ana",
    business: "Ana García",
    city: "Ciudad Juárez",
    state: "Chihuahua",
    whatsapp: "5216561234567",
    description: "Joyería NICE disponible para entrega inmediata. Entrego en el centro o te la mando.",
    instagram: "@ana.nice",
    palette: "dorado",
    delivery: "Entrega en persona en Ciudad Juárez o envío por paquetería",
    payment: "Efectivo, transferencia",
    schedule: "Lunes a sábado, 10 a 7",
  },
  {
    name: "María López",
    email: "maria@nicehub.mx",
    slug: "maria",
    business: "María López",
    city: "Monterrey",
    state: "Nuevo León",
    whatsapp: "5218112345678",
    description: "Piezas seleccionadas de NICE. Apartados con el 30%.",
    instagram: "@maria.joyeria",
    palette: "rosa",
    delivery: "Envío a todo Monterrey",
    payment: "Transferencia, tarjeta",
    schedule: "Todos los días, 9 a 8",
  },
  {
    name: "Carlos Rodríguez",
    email: "carlos@nicehub.mx",
    slug: "carlos",
    business: "Carlos Rodríguez",
    city: "Guadalajara",
    state: "Jalisco",
    whatsapp: "5213312345678",
    description: "Especializado en piezas de caballero y cadenas. Lo que ves es lo que tengo.",
    instagram: "@carlos.nice",
    palette: "negro",
    delivery: "Entrega en persona o envío nacional",
    payment: "Efectivo, transferencia",
    schedule: "Lunes a viernes, 11 a 6",
  },
];

const CUSTOMERS = [
  ["María Fernanda Ruiz", "5216561112233"],
  ["Laura Domínguez", "5216562223344"],
  ["Sofía Herrera", "5216563334455"],
  ["Gabriela Ortiz", "5218114445566"],
  ["Patricia Nava", "5218115556677"],
  ["Daniela Cordero", "5218116667788"],
  ["Alejandra Ibarra", "5213317778899"],
  ["Roberto Salas", "5213318889900"],
  ["Karla Montes", "5216564445566"],
  ["Verónica Pineda", "5218117779900"],
];

// --- Construccion ----------------------------------------------------------

async function build() {
  const out = [];
  const push = (sql) => out.push(sql);

  push("-- Datos de demostración de NICE Seller Hub.");
  push("-- Generado por scripts/build-seed.mjs. No editar a mano.");
  push("");
  push("PRAGMA defer_foreign_keys = true;");
  push("");

  // Limpieza: el seed se puede volver a correr sin duplicar nada.
  for (const t of [
    "loyalty_transactions", "loyalty_accounts", "sale_items", "sales",
    "order_items", "orders", "order_counters", "inventory_movements",
    "seller_inventory", "seller_customers", "customers", "products",
    "categories", "sellers", "users", "rate_limits",
  ]) {
    push(`DELETE FROM ${t};`);
  }
  push("DELETE FROM sqlite_sequence;");
  push("");

  // Categorias
  push("-- Categorías");
  CATEGORIES.forEach(([name, slug], i) => {
    push(
      `INSERT INTO categories (id, name, slug, image, position, status) VALUES (${i + 1}, ${q(name)}, ${q(slug)}, NULL, ${i}, 'active');`
    );
  });
  push("");

  // Usuarios y distribuidoras
  push("-- Cuentas");
  push(`-- Contraseña de todas las cuentas demo: ${DEMO_PASSWORD}`);

  const adminSalt = randomHex(16);
  const adminHash = await hashPassword(DEMO_PASSWORD, adminSalt);
  push(
    `INSERT INTO users (id, name, email, phone, role, password_hash, password_salt, password_iterations, created_at) VALUES (1, 'Administración NICE', 'admin@nicehub.mx', NULL, 'admin', ${q(adminHash)}, ${q(adminSalt)}, ${PBKDF2_ITERATIONS}, ${q(iso(120))});`
  );

  for (const [i, s] of SELLERS.entries()) {
    const userId = i + 2;
    const salt = randomHex(16);
    const hash = await hashPassword(DEMO_PASSWORD, salt);
    push(
      `INSERT INTO users (id, name, email, phone, role, password_hash, password_salt, password_iterations, created_at) VALUES (${userId}, ${q(s.name)}, ${q(s.email)}, ${q(s.whatsapp)}, 'seller', ${q(hash)}, ${q(salt)}, ${PBKDF2_ITERATIONS}, ${q(iso(90 - i * 10))});`
    );
    push(
      `INSERT INTO sellers (id, user_id, slug, business_name, profile_image, cover_image, description, city, state, whatsapp, instagram, facebook, schedule, delivery_methods, payment_methods, status, created_at, updated_at) VALUES (${i + 1}, ${userId}, ${q(s.slug)}, ${q(s.business)}, ${q(avatarImage(s.name[0], s.palette))}, NULL, ${q(s.description)}, ${q(s.city)}, ${q(s.state)}, ${q(s.whatsapp)}, ${q(s.instagram)}, NULL, ${q(s.schedule)}, ${q(s.delivery)}, ${q(s.payment)}, 'active', ${q(iso(90 - i * 10))}, ${q(iso(1))});`
    );
  }
  push("");

  // Productos
  push("-- Catálogo global");
  PRODUCTS.forEach((p, i) => {
    const [code, name, catSlug, shape, palette, material, finish, , description] = p;
    // p[7] es el precio de lista del catalogo, que se guarda como sugerencia.
    push(
      `INSERT INTO products (id, nice_code, name, description, category_id, material, finish, image_url, suggested_price_cents, gallery, created_by_seller_id, created_at, updated_at) VALUES (${i + 1}, ${q(code)}, ${q(name)}, ${q(description)}, ${CAT[catSlug]}, ${q(material)}, ${q(finish)}, ${q(productImage(shape, palette))}, ${p[7] * 100}, NULL, NULL, ${q(iso(80))}, ${q(iso(80))});`
    );
  });
  push("");

  // Clientes
  push("-- Clientes");
  CUSTOMERS.forEach(([name, phone], i) => {
    push(
      `INSERT INTO customers (id, name, phone, email, created_at) VALUES (${i + 1}, ${q(name)}, ${q(phone)}, NULL, ${q(iso(between(40, 75)))});`
    );
  });
  push("");

  /**
   * Cada distribuidora tiene un subconjunto distinto del catalogo, con precios
   * y existencias propios. Eso es justo lo que la plataforma tiene que
   * demostrar: el 826031 puede estar disponible con Ana y agotado con María.
   */
  const inventory = []; // { id, sellerId, productIndex, priceCents, stock, movements[] }
  let invId = 0;

  const ASSIGNMENTS = [
    // Ana: catálogo amplio de dama.
    { seller: 1, products: [0, 1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 18], priceShift: 0 },
    // María: piezas de precio medio y sets.
    { seller: 2, products: [0, 1, 3, 4, 7, 10, 13, 14, 16, 17, 18], priceShift: 0.06 },
    // Carlos: caballero y cadenas.
    { seller: 3, products: [2, 5, 8, 9, 15, 18, 19, 0], priceShift: -0.04 },
  ];

  for (const a of ASSIGNMENTS) {
    for (const pi of a.products) {
      invId++;
      const base = PRODUCTS[pi][7];
      // Se conserva el precio psicologico (1099, no 1100): redondear a decenas
      // le quita a la tienda justo el detalle que la hace ver de catalogo.
      const priceCents = Math.round(base * (1 + a.priceShift)) * 100;
      inventory.push({
        id: invId,
        sellerId: a.seller,
        productIndex: pi,
        priceCents,
        initialStock: between(2, 8),
        stock: 0,
        createdAt: iso(between(50, 70)),
      });
    }
  }
  for (const inv of inventory) inv.stock = inv.initialStock;

  const movements = [];
  let movementId = 0;
  function addMovement(m) {
    movements.push({ id: ++movementId, ...m });
  }

  for (const inv of inventory) {
    addMovement({
      sellerId: inv.sellerId,
      productId: inv.productIndex + 1,
      type: "add",
      delta: inv.initialStock,
      before: 0,
      after: inv.initialStock,
      reason: "Alta en inventario",
      referenceId: null,
      at: inv.createdAt,
    });
  }

  // Ventas: se aplican en orden cronologico descontando existencias.
  const sales = [];
  const saleItems = [];
  const loyalty = new Map(); // "sellerId:customerId" -> points
  let saleId = 0;
  let saleItemId = 0;

  const PAYMENTS = ["efectivo", "transferencia", "transferencia", "tarjeta", "efectivo"];

  const salePlan = [];
  for (let d = 55; d >= 0; d--) {
    // Unos dias sin ventas: una grafica sin huecos no se parece a un negocio.
    if (rand() < 0.55) continue;
    const howMany = rand() < 0.75 ? 1 : 2;
    for (let k = 0; k < howMany; k++) salePlan.push(d);
  }

  for (const daysAgo of salePlan) {
    const sellerId = rand() < 0.5 ? 1 : rand() < 0.6 ? 2 : 3;
    const pool = inventory.filter((i) => i.sellerId === sellerId && i.stock > 0);
    if (pool.length === 0) continue;

    const lineCount = rand() < 0.7 ? 1 : 2;
    const chosen = [];
    for (let k = 0; k < lineCount; k++) {
      const inv = pick(pool);
      if (chosen.some((c) => c.id === inv.id)) continue;
      if (inv.stock <= 0) continue;
      chosen.push(inv);
    }
    if (chosen.length === 0) continue;

    // 3 de cada 4 ventas quedan a nombre de una clienta; el resto son de
    // mostrador, que tambien pasa y conviene que aparezca.
    const named = rand() < 0.78;
    const customerId = named ? between(1, CUSTOMERS.length) : null;

    saleId++;
    const at = iso(daysAgo, between(10, 19), between(0, 59));
    let total = 0;

    for (const inv of chosen) {
      const qty = inv.stock > 2 && rand() < 0.25 ? 2 : 1;
      const take = Math.min(qty, inv.stock);
      const before = inv.stock;
      inv.stock -= take;

      const subtotal = inv.priceCents * take;
      total += subtotal;

      saleItemId++;
      saleItems.push({
        id: saleItemId,
        saleId,
        productId: inv.productIndex + 1,
        name: PRODUCTS[inv.productIndex][1],
        code: PRODUCTS[inv.productIndex][0],
        quantity: take,
        unitPriceCents: inv.priceCents,
        subtotalCents: subtotal,
      });

      addMovement({
        sellerId,
        productId: inv.productIndex + 1,
        type: "sale",
        delta: -take,
        before,
        after: inv.stock,
        reason: "Venta",
        referenceId: saleId,
        at,
      });
    }

    sales.push({
      id: saleId,
      sellerId,
      customerId,
      totalCents: total,
      paymentMethod: pick(PAYMENTS),
      at,
    });

    if (customerId !== null) {
      const key = `${sellerId}:${customerId}`;
      loyalty.set(key, (loyalty.get(key) ?? 0) + Math.floor(total / 1000));
    }
  }

  push("-- Inventario por distribuidora");
  for (const inv of inventory) {
    // Un par de piezas quedan ocultas a proposito, para que se vea que la
    // visibilidad es independiente de las existencias.
    const hidden = inv.id === 9 || inv.id === 22;
    push(
      `INSERT INTO seller_inventory (id, seller_id, product_id, price_cents, stock, is_visible, created_at, updated_at) VALUES (${inv.id}, ${inv.sellerId}, ${inv.productIndex + 1}, ${inv.priceCents}, ${inv.stock}, ${hidden ? 0 : 1}, ${q(inv.createdAt)}, ${q(iso(between(0, 5)))});`
    );
  }
  push("");

  push("-- Movimientos de inventario");
  for (const m of movements) {
    push(
      `INSERT INTO inventory_movements (id, seller_id, product_id, type, delta, stock_before, stock_after, reason, reference_id, created_at) VALUES (${m.id}, ${m.sellerId}, ${m.productId}, ${q(m.type)}, ${m.delta}, ${m.before}, ${m.after}, ${q(m.reason)}, ${m.referenceId ?? "NULL"}, ${q(m.at)});`
    );
  }
  push("");

  push("-- Ventas");
  for (const s of sales) {
    push(
      `INSERT INTO sales (id, seller_id, customer_id, order_id, total_cents, payment_method, note, created_at) VALUES (${s.id}, ${s.sellerId}, ${s.customerId ?? "NULL"}, NULL, ${s.totalCents}, ${q(s.paymentMethod)}, NULL, ${q(s.at)});`
    );
  }
  push("");
  for (const i of saleItems) {
    push(
      `INSERT INTO sale_items (id, sale_id, product_id, name_snapshot, code_snapshot, quantity, unit_price_cents, subtotal_cents) VALUES (${i.id}, ${i.saleId}, ${i.productId}, ${q(i.name)}, ${q(i.code)}, ${i.quantity}, ${i.unitPriceCents}, ${i.subtotalCents});`
    );
  }
  push("");

  // La relacion tienda-cliente se deriva de quien le compro a quien.
  push("-- Cartera de clientes por distribuidora");
  const pairs = new Set();
  for (const s of sales) {
    if (s.customerId !== null) pairs.add(`${s.sellerId}:${s.customerId}`);
  }
  let scId = 0;
  for (const pair of pairs) {
    const [sellerId, customerId] = pair.split(":").map(Number);
    scId++;
    push(
      `INSERT INTO seller_customers (id, seller_id, customer_id, created_at) VALUES (${scId}, ${sellerId}, ${customerId}, ${q(iso(between(30, 60)))});`
    );
  }
  push("");

  push("-- Lealtad");
  let laId = 0;
  let ltId = 0;
  for (const [key, points] of loyalty) {
    const [sellerId, customerId] = key.split(":").map(Number);
    laId++;
    push(
      `INSERT INTO loyalty_accounts (id, seller_id, customer_id, points, created_at, updated_at) VALUES (${laId}, ${sellerId}, ${customerId}, ${points}, ${q(iso(50))}, ${q(iso(1))});`
    );
    ltId++;
    push(
      `INSERT INTO loyalty_transactions (id, account_id, type, points, description, reference_id, created_at) VALUES (${ltId}, ${laId}, 'earn', ${points}, 'Puntos acumulados por compras', NULL, ${q(iso(1))});`
    );
  }
  push("");

  // Pedidos: intenciones de compra, sin descontar existencias.
  push("-- Pedidos");
  const ORDER_STATES = [
    "pending", "whatsapp_sent", "whatsapp_sent", "confirmed",
    "preparing", "delivered", "delivered", "cancelled",
  ];

  let orderId = 0;
  let orderItemId = 0;
  const counters = new Map();

  for (let n = 0; n < 12; n++) {
    const daysAgo = between(0, 20);
    const sellerId = n % 3 === 0 ? 2 : n % 3 === 1 ? 1 : 3;
    const pool = inventory.filter((i) => i.sellerId === sellerId && i.stock > 0);
    if (pool.length === 0) continue;

    const at = iso(daysAgo, between(9, 21), between(0, 59));
    const day = at.slice(0, 10).replace(/-/g, "");
    const seq = (counters.get(day) ?? 0) + 1;
    counters.set(day, seq);

    orderId++;
    const number = `NICE-${day}-${String(seq).padStart(4, "0")}`;
    const customerId = between(1, CUSTOMERS.length);
    const [cName, cPhone] = CUSTOMERS[customerId - 1];

    const lineCount = between(1, 3);
    let total = 0;
    const picked = [];
    for (let k = 0; k < lineCount; k++) {
      const inv = pick(pool);
      if (picked.some((p) => p.id === inv.id)) continue;
      picked.push(inv);
    }

    // Las partidas se calculan primero pero se escriben DESPUES del pedido:
    // order_items.order_id apunta a orders.id, y al aplicar el archivo contra
    // D1 remoto cada lote se valida por separado, sin diferir las llaves.
    const itemRows = [];
    for (const inv of picked) {
      const qty = Math.min(rand() < 0.25 ? 2 : 1, inv.stock);
      const subtotal = inv.priceCents * qty;
      total += subtotal;
      orderItemId++;
      itemRows.push(
        `INSERT INTO order_items (id, order_id, product_id, name_snapshot, code_snapshot, quantity, unit_price_cents, subtotal_cents) VALUES (${orderItemId}, ${orderId}, ${inv.productIndex + 1}, ${q(PRODUCTS[inv.productIndex][1])}, ${q(PRODUCTS[inv.productIndex][0])}, ${qty}, ${inv.priceCents}, ${subtotal});`
      );
    }

    push(
      `INSERT INTO orders (id, seller_id, customer_id, order_number, status, contact_name, contact_phone, note, subtotal_cents, total_cents, created_at, updated_at) VALUES (${orderId}, ${sellerId}, ${customerId}, ${q(number)}, ${q(pick(ORDER_STATES))}, ${q(cName)}, ${q(cPhone)}, NULL, ${total}, ${total}, ${q(at)}, ${q(at)});`
    );
    for (const row of itemRows) push(row);
  }
  push("");

  push("-- Contadores de folio, al día con los pedidos ya creados");
  for (const [day, seq] of counters) {
    push(`INSERT INTO order_counters (day, last_seq) VALUES (${q(day)}, ${seq});`);
  }
  push("");

  writeFileSync(new URL("./seed.sql", import.meta.url), out.join("\n") + "\n", "utf8");

  console.log("seed.sql generado:");
  console.log(`  ${SELLERS.length} distribuidoras + 1 admin`);
  console.log(`  ${PRODUCTS.length} productos, ${inventory.length} líneas de inventario`);
  console.log(`  ${CUSTOMERS.length} clientes, ${sales.length} ventas, ${orderId} pedidos`);
  console.log(`  contraseña demo: ${DEMO_PASSWORD}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
