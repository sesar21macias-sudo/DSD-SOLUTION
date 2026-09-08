import "server-only";

import { baseCode, normalizeNiceCode } from "./nice-code";

/**
 * Resuelve un Id Nice contra la tienda oficial de NICE (niceonline.com) para
 * traer la foto, el nombre, la descripción y el precio de catálogo de la pieza.
 *
 * Por qué existe: sin esto, una pieza recién recibida entra al inventario con
 * el nombre que trae el ticket ("ARETES") y sin foto — y una tienda de joyería
 * sin fotos no vende. Con esto, la distribuidora toma la foto de su ticket y
 * sus piezas aparecen publicadas como se ven en el catálogo.
 *
 * Cómo funciona, y por qué así:
 *
 * 1. Se busca el código en `/mx/search`. La búsqueda de la tienda es difusa y
 *    devuelve quince resultados, así que el primero NO se acepta por ser el
 *    primero.
 * 2. Se abre la ficha de los primeros candidatos y se lee su JSON-LD
 *    (schema.org/Product), que trae `sku`. **Solo se acepta cuando ese `sku`
 *    coincide exactamente con el código.** Es la única forma de no colgarle a
 *    una pieza la foto de otra.
 * 3. Ese mismo `sku` resuelve de paso la ambigüedad `1`/`I`/`L` del papel
 *    térmico: si leímos "9250941" y NICE dice que el sku es "925094L", NICE
 *    tiene la razón — es su propio catálogo.
 *
 * El `robots.txt` de niceonline.com permite `/search` y `/products/`; solo
 * bloquea carrito, cuenta y checkout, que aquí no se tocan.
 */

const BASE = "https://www.niceonline.com";

/** Identificarse es lo correcto y permite que NICE nos bloquee si lo prefiere. */
const USER_AGENT =
  "NiceSellerHub/1.0 (catálogo para distribuidoras NICE; +https://nice-seller-hub.sesar21macias.workers.dev)";

/** Si la tienda tarda más que esto, la recepción sigue sin ella. */
const TIMEOUT_MS = 8000;

/** Fichas que se abren por código antes de rendirse. */
const MAX_CANDIDATES = 2;

export interface NiceProduct {
  /** El sku oficial. Puede diferir del código leído si el papel era ambiguo. */
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  sourceUrl: string;
}

/**
 * Variantes plausibles de un código mal leído. En papel térmico `1`, `I` y `L`
 * son casi idénticos, y `O` con `0`. Se generan solo para los caracteres
 * ambiguos y se acotan, para no disparar una explosión combinatoria.
 */
export function codeVariants(code: string): string[] {
  const upper = code.toUpperCase();
  const swaps: Record<string, string[]> = {
    "1": ["L", "I"],
    L: ["1", "I"],
    I: ["1", "L"],
    "0": ["O"],
    O: ["0"],
  };

  const out = new Set<string>([upper]);

  // Solo se permuta un carácter a la vez: dos errores en el mismo código son
  // raros, y probar todas las combinaciones multiplicaría las peticiones.
  for (let i = 0; i < upper.length; i++) {
    for (const alt of swaps[upper[i]] ?? []) {
      out.add(upper.slice(0, i) + alt + upper.slice(i + 1));
      if (out.size >= 8) return [...out];
    }
  }
  return [...out];
}

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    // Una tienda lenta o caída no puede tumbar la recepción: la pieza queda
    // como "no encontrada" y la persona la resuelve a mano.
    return null;
  }
}

/** Los bloques <script type="application/ld+json"> de una página. */
function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      // Un bloque malformado se ignora; los demás pueden servir.
    }
  }
  return blocks;
}

function findProductLd(html: string): Record<string, unknown> | null {
  for (const block of jsonLdBlocks(html)) {
    // Puede venir suelto, en @graph, o en un arreglo.
    const candidates = Array.isArray(block)
      ? block
      : [block, ...(((block as Record<string, unknown>)?.["@graph"] as unknown[]) ?? [])];

    for (const c of candidates) {
      if (c && typeof c === "object" && (c as Record<string, unknown>)["@type"] === "Product") {
        return c as Record<string, unknown>;
      }
    }
  }
  return null;
}

/** Los handles de producto de una página de resultados, en orden. */
function searchHandles(html: string): string[] {
  const handles: string[] = [];
  const re = /\/products\/([a-z0-9][a-z0-9-]{0,80})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const handle = m[1].toLowerCase();
    if (!handles.includes(handle)) handles.push(handle);
  }
  return handles;
}

function firstString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

/** El precio del primer Offer, en centavos. */
function offerPriceCents(ld: Record<string, unknown>): number | null {
  const offers = ld.offers;
  const first = Array.isArray(offers) ? offers[0] : offers;
  if (!first || typeof first !== "object") return null;
  const price = Number((first as Record<string, unknown>).price);
  return Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null;
}

/**
 * La imagen del JSON-LD viene en tamaño de origen. El CDN de Shopify acepta
 * parámetros de render, así que se pide una versión cuadrada de 800 px: es la
 * proporción con la que se muestran las tarjetas de la tienda.
 */
function sizedImage(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("cdn.shopify.com")) return url;
    u.searchParams.set("width", "800");
    u.searchParams.set("height", "800");
    u.searchParams.set("crop", "center");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Busca una pieza por su Id Nice. Devuelve null si no se pudo confirmar por
 * `sku`: es preferible dejarla sin resolver a ponerle la foto equivocada.
 */
export async function lookupNiceProduct(code: string): Promise<NiceProduct | null> {
  const upper = normalizeNiceCode(code);

  /**
   * Los anillos llevan la talla pegada al codigo: "426307/6". La tienda de
   * NICE lista el modelo, no cada talla, asi que se busca por el modelo y se
   * acepta su `sku` como bueno — la foto, el nombre y el precio son los mismos
   * para todas las tallas; lo unico que cambia es cual tiene ella en la mano.
   */
  const model = baseCode(upper);
  const wanted = new Set([...codeVariants(upper), ...codeVariants(model)]);

  /**
   * Qué se le pregunta al buscador de NICE.
   *
   * Primero el código tal cual. Si el último carácter es de los ambiguos, se
   * busca también sin él: la búsqueda de la tienda no encuentra "9250941"
   * —ese código no existe— pero sí encuentra "925094", y de ahí sale
   * "925094L", que es la pieza real. Buscar por el tronco resuelve de una vez
   * todas las variantes del último carácter, en lugar de una petición por cada
   * una.
   */
  const queries = [upper];
  if (model !== upper) queries.push(model);
  if (model.length > 4 && /[1IL0O]$/.test(model)) {
    queries.push(model.slice(0, -1));
  }

  const seen = new Set<string>();

  for (const query of queries) {
    const search = await get(`${BASE}/mx/search?q=${encodeURIComponent(query)}`);
    if (!search) continue;

    for (const handle of searchHandles(search).slice(0, MAX_CANDIDATES)) {
      if (seen.has(handle)) continue;
      seen.add(handle);

      const url = `${BASE}/mx/products/${handle}`;
      const page = await get(url);
      if (!page) continue;

      const ld = findProductLd(page);
      if (!ld) continue;

      const sku = firstString(ld.sku)?.trim().toUpperCase();
      if (!sku || !wanted.has(sku)) continue;

      const name = firstString(ld.name)?.trim();
      if (!name) continue;

      return {
        sku,
        name: name.slice(0, 160),
        description: firstString(ld.description)?.trim().slice(0, 600) ?? null,
        imageUrl: sizedImage(firstString(ld.image)),
        priceCents: offerPriceCents(ld),
        sourceUrl: url,
      };
    }
  }

  return null;
}

/**
 * NICE nombra sus piezas empezando por el tipo ("Aretes arracada...",
 * "Collar...", "Pulsera..."). Con eso alcanza para archivarlas en la categoría
 * correcta sin pedirle nada a la distribuidora.
 */
const CATEGORY_BY_FIRST_WORD: Record<string, string> = {
  anillo: "anillos",
  anillos: "anillos",
  arete: "aretes",
  aretes: "aretes",
  arracada: "aretes",
  arracadas: "aretes",
  broquel: "aretes",
  broqueles: "aretes",
  huggie: "aretes",
  collar: "collares",
  collares: "collares",
  gargantilla: "collares",
  choker: "collares",
  pulsera: "pulseras",
  pulseras: "pulseras",
  esclava: "pulseras",
  dije: "dijes",
  dijes: "dijes",
  medalla: "dijes",
  cadena: "cadenas",
  cadenas: "cadenas",
  charm: "charms",
  charms: "charms",
  set: "sets",
  juego: "sets",
  tobillera: "especiales",
};

export function guessCategorySlug(name: string): string | null {
  const first = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[̀-ͯ]", "g"), "")
    .split(/\s+/)[0];
  return CATEGORY_BY_FIRST_WORD[first] ?? null;
}
