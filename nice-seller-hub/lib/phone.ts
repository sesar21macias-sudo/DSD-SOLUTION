/**
 * Los telefonos se guardan normalizados a formato internacional, solo digitos:
 * 5216561234567. Guardarlos como los escribio cada quien ("656 123 4567",
 * "+52 656-123-4567") es lo que hace que el enlace de WhatsApp funcione en un
 * telefono y no en otro, y que el mismo cliente aparezca dos veces en la
 * cartera de una distribuidora.
 */

const MX = "52";

export interface PhoneResult {
  ok: boolean;
  /** Solo digitos, con lada de pais. */
  value: string;
  error?: string;
}

/**
 * Normaliza asumiendo Mexico cuando no viene lada de pais.
 *
 * Sobre el "1" despues del 52: WhatsApp acepta ambas formas para numeros
 * mexicanos y resuelve internamente, pero el prefijo 521 es el que Meta
 * documenta para moviles, asi que es el que se guarda.
 */
export function normalizePhone(input: string, defaultCountry = MX): PhoneResult {
  const digits = (input ?? "").replace(/\D/g, "");

  if (digits.length === 0) return { ok: false, value: "", error: "Escribe un numero." };
  if (digits.length < 10) {
    return { ok: false, value: digits, error: "Faltan digitos: son 10 mas la lada del pais." };
  }
  if (digits.length > 15) {
    return { ok: false, value: digits, error: "Ese numero tiene demasiados digitos." };
  }

  // 10 digitos = numero nacional mexicano.
  if (digits.length === 10) return { ok: true, value: `${defaultCountry}1${digits}` };

  // 52 + 10 sin el 1 movil: se lo agregamos.
  if (digits.length === 12 && digits.startsWith(MX)) {
    return { ok: true, value: `${MX}1${digits.slice(2)}` };
  }

  // 521 + 10, o cualquier otro pais ya en formato internacional.
  return { ok: true, value: digits };
}

/** "+52 1 656 123 4567" — solo para mostrar. */
export function displayPhone(stored: string): string {
  if (stored.startsWith("521") && stored.length === 13) {
    const n = stored.slice(3);
    return `+52 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  if (stored.length === 10) return `${stored.slice(0, 3)} ${stored.slice(3, 6)} ${stored.slice(6)}`;
  return `+${stored}`;
}

/**
 * Los ultimos 4 digitos, para que la distribuidora reconozca a su cliente en
 * una lista sin que el telefono completo quede a la vista de nadie mas.
 */
export function maskPhone(stored: string): string {
  return `•••• ${stored.slice(-4)}`;
}
