/**
 * Ruta interna segura para redirigir después de entrar o al salir de una vista.
 * "/x" sí; "//sitio", "/\sitio" o "https://…" no: los navegadores tratan las dos
 * primeras como otro dominio y servirían para mandar a alguien a una página falsa.
 */
export function internalPath(p: unknown): string | null {
  if (typeof p !== "string" || !p.startsWith("/")) return null;
  if (p.startsWith("//") || p.includes("\\")) return null;
  return p;
}
