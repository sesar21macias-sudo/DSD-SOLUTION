import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { getSessionSecret } from "@/lib/secret";

/**
 * Primera puerta: nadie sin sesion entra al panel ni al admin.
 *
 * No es la unica puerta. Cada pagina vuelve a pedir `requireSeller()` y cada
 * consulta acota por `sellerId`; el middleware solo evita el viaje. Confiar en
 * una sola capa es como cerrar la reja y dejar la casa abierta.
 */

const PROTECTED = ["/dashboard", "/admin"];
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p);

  if (!needsAuth && !isAuthPage) return NextResponse.next();

  let claims = null;
  try {
    claims = await readSession(req.cookies.get(SESSION_COOKIE)?.value, await getSessionSecret());
  } catch {
    // Si la base no responde no dejamos pasar a nadie: fallar cerrado.
    claims = null;
  }

  if (isAuthPage) {
    if (!claims) return NextResponse.next();
    return NextResponse.redirect(new URL(claims.role === "admin" ? "/admin" : "/dashboard", req.url));
  }

  if (!claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?volver=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // El area de admin es solo para admins. Una distribuidora que llegue aqui
  // por curiosidad termina en su propio panel, no en un error.
  if (pathname.startsWith("/admin") && claims.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
