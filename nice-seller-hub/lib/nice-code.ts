/**
 * El código NICE de una pieza.
 *
 * Casi todos son alfanuméricos —`826031`, `925094L`—, pero **los anillos llevan
 * talla y la talla va después de una diagonal**: `426307/6` es el modelo 426307
 * en talla 6. Esa diagonal rompía el sistema en silencio: todas las
 * validaciones aceptaban solo letras, números y guiones, así que los anillos se
 * caían del OCR, del autollenado y del alta manual sin decir por qué.
 *
 * Dos tallas del mismo anillo son dos piezas distintas —se tienen y se venden
 * por separado—, así que el código completo, con su talla, es la identidad.
 */

/** Letras, números, guiones y la diagonal de la talla. */
export const NICE_CODE_RE = /^[A-Z0-9][A-Z0-9/-]{2,19}$/;

/** Lo mismo, tolerando minúsculas: para validar lo que alguien acaba de teclear. */
export const NICE_CODE_RE_LOOSE = /^[A-Za-z0-9][A-Za-z0-9/-]{2,19}$/;

/** Mayúsculas y sin espacios, que es como se guarda siempre. */
export function normalizeNiceCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isNiceCode(raw: string): boolean {
  return NICE_CODE_RE.test(normalizeNiceCode(raw));
}

/** El modelo sin la talla: `426307/6` → `426307`. */
export function baseCode(code: string): string {
  return normalizeNiceCode(code).split("/")[0];
}

/** La talla, o null si la pieza no lleva: `426307/6` → `6`. */
export function ringSize(code: string): string | null {
  const parts = normalizeNiceCode(code).split("/");
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

/** "Talla 6" para enseñarlo junto al nombre de la pieza. */
export function sizeLabel(code: string): string | null {
  const size = ringSize(code);
  return size ? `Talla ${size}` : null;
}

/**
 * El código convertido en un trozo de URL.
 *
 * Una diagonal dentro de un código partiría la ruta en dos segmentos y
 * `/ana/product/426307/6` no existiría. Se cambia por `~`, que no aparece en
 * ningún código NICE y no necesita escaparse en una URL — así el enlace se
 * sigue leyendo y se puede dictar por teléfono.
 */
export function codeToParam(code: string): string {
  return normalizeNiceCode(code).replace(/\//g, "~");
}

/** El camino de vuelta, para leer el parámetro de la URL. */
export function paramToCode(param: string): string {
  return normalizeNiceCode(decodeURIComponent(param).replace(/~/g, "/"));
}
