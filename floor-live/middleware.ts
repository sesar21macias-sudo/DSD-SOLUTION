import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { getSessionSecret } from "@/lib/secret";

/*
 * Next.js 16 renombró "middleware" a "proxy", pero proxy solo corre en el
 * runtime de Node, que en Cloudflare (OpenNext) es experimental. Se queda como
 * middleware a propósito. La protección real no depende de este archivo:
 * cada página y cada API revisan la sesión por su cuenta.
 */

/** Páginas que se ven sin haber entrado. /tv se autentica con su propia cookie de pantalla. */
const PUBLIC = ["/entrar", "/inicio", "/tv"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Defensa extra contra CSRF (además de SameSite=Lax): un cambio que llega
    // desde otro sitio se rechaza aunque el navegador mande la cookie.
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.get("origin");
      let sameSite = true;
      if (origin) {
        try {
          sameSite = new URL(origin).host === req.nextUrl.host;
        } catch {
          sameSite = false; // "null" u otro origen ilegible
        }
      }
      if (!sameSite) {
        return NextResponse.json({ error: "Request rejected." }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (pathname === "/tv" || pathname.startsWith("/tv/")) return NextResponse.next();

  let uid: number | null = null;
  try {
    uid = await readSession(req.cookies.get(SESSION_COOKIE)?.value, await getSessionSecret());
  } catch {
    // Si la base no responde, no dejamos pasar a nadie: fallar cerrado.
    uid = null;
  }

  if (uid !== null && isPublic) return NextResponse.redirect(new URL("/", req.url));
  if (uid !== null || isPublic) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = pathname === "/" ? "" : `?volver=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icon|apple-icon|manifest|brand/|.*\\.(?:png|svg|ico|webp|webmanifest)$).*)"],
};
