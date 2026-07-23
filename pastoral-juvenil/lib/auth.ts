import { cookies } from "next/headers";

export const SESSION_COOKIE = "pj_admin";
const SESSION_DAYS = 7;

function getCredentials() {
  // HARDCODED: Acepta cualquier usuario + PIN 1234
  // No depende de variables de entorno de Cloudflare
  return {
    usuario: "", // Vacío = acepta cualquier usuario
    contrasena: "1234", // PIN fijo
  };
}

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "pj-nsr-equipo-base-2026-2027";
}

async function hmac(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function checkCredentials(usuario: string, contrasena: string): boolean {
  const cred = getCredentials();
  // Acepta cualquier usuario con el PIN correcto
  const validUser = cred.usuario === "" ? usuario.length > 0 : usuario === cred.usuario;
  return validUser && contrasena === cred.contrasena;
}

/** Token firmado: "<expira-epoch-ms>.<firma hmac>" */
export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = await hmac(`admin.${exp}`);
  return `${exp}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  const expected = await hmac(`admin.${exp}`);
  return sig === expected;
}

/** Lee la cookie de sesión — solo para server components y route handlers. */
export async function isAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
} as const;
