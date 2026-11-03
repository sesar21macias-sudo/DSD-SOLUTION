export const SESSION_COOKIE = "fl_session";
export const SESSION_DAYS = 60;

/**
 * PBKDF2-SHA256. No es Argon2, pero es lo que hay en el runtime de Workers
 * sin meter una dependencia nativa, y con sal por usuario cumple para esto.
 * El número de vueltas se guarda con cada usuario: si algún día se sube,
 * las cuentas viejas siguen entrando y se pueden re-hashear al vuelo.
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

/** Comparación de tiempo constante: no filtra el secreto por latencia. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- Sesión: cookie firmada, sin tabla de sesiones -------------------------
// Verificarla cuesta un HMAC, no un viaje a la base. El middleware corre en
// cada request, así que eso importa.

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

interface SessionPayload {
  uid: number;
  exp: number;
}

export async function signSession(uid: number, secret: string, days = SESSION_DAYS): Promise<string> {
  const payload: SessionPayload = {
    uid,
    exp: Date.now() + days * 86_400_000,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${toHex(sig)}`;
}

/** Devuelve el id del usuario, o null si la cookie es inválida o expiró. */
export async function readSession(
  token: string | undefined,
  secret: string
): Promise<number | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expected: string;
  try {
    const buf = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
    expected = toHex(buf);
  } catch {
    return null;
  }
  if (!safeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body)) as SessionPayload;
    if (typeof payload.uid !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

// --- Reglas de usuario -----------------------------------------------------

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Devuelve la llave del problema (ver errors en lib/i18n/dict.ts), o null si está bien. */
export function validatePassword(pw: string): "passwordShort" | "passwordLong" | null {
  if (pw.length < 8) return "passwordShort";
  if (pw.length > 200) return "passwordLong";
  return null;
}

export function validateUsername(u: string): "usernameShort" | "usernameLong" | "usernameChars" | null {
  if (u.length < 3) return "usernameShort";
  if (u.length > 20) return "usernameLong";
  if (!USERNAME_RE.test(u)) return "usernameChars";
  return null;
}
