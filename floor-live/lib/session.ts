import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession } from "./auth";
import { getSessionSecret } from "./secret";
import { first } from "./db";
import type { User } from "./types";
import type { ErrorKey } from "./i18n/dict";

/**
 * El usuario de la sesión actual, o null. Una cuenta desactivada pierde el
 * acceso en su siguiente request aunque conserve la cookie.
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const uid = await readSession(token, await getSessionSecret());
  if (uid === null) return null;

  const user = await first<User>(
    "SELECT id, username, name, role, team_id, active, display_only FROM users WHERE id = ?",
    uid
  );
  if (!user || !user.active) return null;
  return user;
}

/** Para páginas: manda a /entrar si no hay sesión. */
export async function pageUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

/** Error con su código HTTP y la llave del mensaje; `handler` lo traduce al idioma de quien pidió. */
export class HttpError extends Error {
  public args: unknown[];
  constructor(
    public status: number,
    public key: ErrorKey,
    ...args: unknown[]
  ) {
    super(key);
    this.args = args;
  }
}

/** Para route handlers: el usuario o un 401. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "sessionEnded");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireEditor();
  if (user.role !== "admin") throw new HttpError(403, "adminOnly");
  return user;
}

/**
 * Contenido de un equipo (o de la planta si teamId es null). El admin puede
 * todo; un líder solo su propio equipo, nunca lo de planta ni de otros.
 */
export async function requireScope(teamId: number | null): Promise<User> {
  const user = await requireEditor();
  if (user.role === "admin") return user;
  if (teamId === null || user.team_id !== teamId) throw new HttpError(403, "notYourTeam");
  return user;
}

export function canTouch(user: User, teamId: number | null): boolean {
  if (user.display_only) return false;
  return user.role === "admin" || (teamId !== null && user.team_id === teamId);
}

/** Ver (no cambiar): la planta la ve cualquiera con sesión; un equipo, su gente, sus pantallas y el admin. */
export function canView(user: User, teamId: number | null): boolean {
  if (teamId === null) return true;
  return (user.role === "admin" && !user.display_only) || user.team_id === teamId;
}

/** Cualquier cambio: una cuenta de pantalla nunca escribe nada. */
export async function requireEditor(): Promise<User> {
  const user = await requireUser();
  if (user.display_only) throw new HttpError(403, "displayOnly");
  return user;
}
