import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, dicts, isLang, langFromHeader, type Dict, type Lang } from "./dict";

/** Cookie elegida por la persona; si no hay, el idioma del navegador. */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  return langFromHeader((await headers()).get("accept-language"));
}

export async function getDict(): Promise<Dict> {
  return dicts[await getLang()];
}

/** Para route handlers, que reciben el Request directamente. */
export function langOfRequest(req: Request): Lang {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(es|en)`));
  if (m && isLang(m[1])) return m[1];
  return langFromHeader(req.headers.get("accept-language"));
}
