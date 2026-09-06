/**
 * Formas de pago. Viven en su propio archivo, sin dependencias, porque los usa
 * tanto el formulario de venta —que corre en el navegador— como las pantallas
 * del servidor. Cuando esta lista estaba dentro de `lib/mutations.ts`, el
 * formulario terminaba arrastrando el binding de la base al bundle del cliente
 * y la pagina dejaba de hidratarse sin decir una palabra.
 */
export const PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "otro", label: "Otro" },
] as const;

export const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.id, m.label])
);
