export const SESSION_COOKIE = "nsh_session";
export const SESSION_DAYS = 30;

/**
 * PBKDF2-SHA256. No es Argon2, pero es lo que ofrece WebCrypto en el runtime
 * de Workers sin meter una dependencia nativa; con sal por usuario cumple para
 * este caso.
 *
 * 100 000 es el tope: el runtime de Cloudflare rechaza cualquier cifra mayor
 * con NotSupportedError, y lo hace en produccion, no al compilar. El numero de
 * vueltas se guarda junto a cada usuario, asi que si algun dia Cloudflare sube
 * el limite se puede subir aqui sin dejar fuera a las cuentas ya creadas.
 */
export const PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(
  password: string,
  salt: string,
  iterations = PBKDF2_ITERATIONS
): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

/** Comparacion en tiempo constante: no filtra el secreto por latencia. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- Sesion: cookie firmada, sin tabla de sesiones -------------------------
// Verificarla cuesta un HMAC, no un viaje a la base. El middleware corre en
// cada request, y eso importa.

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

export interface SessionClaims {
  /** users.id */
  uid: number;
  /** "admin" | "seller" */
  role: string;
  /** Expiracion, epoch en segundos. */
  exp: number;
}

export async function signSession(
  claims: Omit<SessionClaims, "exp">,
  secret: string,
  days = SESSION_DAYS
): Promise<string> {
  const payload: SessionClaims = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + days * 86_400,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${toHex(sig)}`;
}

/**
 * Devuelve los claims o null. Cualquier cosa rara —firma que no cuadra, JSON
 * corrupto, caducada— es null: nunca una excepcion que alguien pueda olvidar
 * atrapar y terminar tratando como sesion valida.
 */
export async function readSession(
  token: string | undefined,
  secret: string
): Promise<SessionClaims | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);

  try {
    const expected = toHex(
      await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body))
    );
    if (!safeEqual(given, expected)) return null;

    const claims = JSON.parse(b64urlDecode(body)) as SessionClaims;
    if (typeof claims.uid !== "number" || typeof claims.exp !== "number") return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeDays = SESSION_DAYS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    maxAge: maxAgeDays * 86_400,
  };
}
