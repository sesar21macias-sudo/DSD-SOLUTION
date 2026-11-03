import "server-only";
import { NextResponse } from "next/server";
import {
  PBKDF2_ITERATIONS,
  SESSION_COOKIE,
  SESSION_DAYS,
  hashPassword,
  randomHex,
  signSession,
} from "./auth";
import { getSessionSecret } from "./secret";

export async function newPasswordFields(password: string) {
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt, PBKDF2_ITERATIONS);
  return { hash, salt, iterations: PBKDF2_ITERATIONS };
}

/**
 * Contraseña temporal legible para dictarla en voz alta o mandarla por
 * WhatsApp: sin 0/O ni 1/l/I, en tres bloques.
 */
export function tempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}

export async function withSession(res: NextResponse, userId: number, req: Request, days = SESSION_DAYS): Promise<NextResponse> {
  const token = await signSession(userId, await getSessionSecret(), days);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
  return res;
}
