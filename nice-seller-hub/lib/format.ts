/**
 * Todo el dinero viaja en centavos enteros. Estas son las unicas funciones que
 * lo convierten a pesos, y solo para mostrarlo o capturarlo.
 */

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** "$1,099 MXN" — el formato que se usa en el mensaje de WhatsApp. */
export function formatMoneyMXN(cents: number): string {
  return `${formatMoney(cents)} MXN`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-MX").format(n);
}

/**
 * Pesos escritos por una persona ("1,099.50", "$1099") a centavos.
 * Devuelve null si no es un numero valido: el llamador decide que hacer,
 * en vez de recibir un NaN que acaba guardado en la base.
 */
export function pesosToCents(input: string | number): number | null {
  const raw = typeof input === "number" ? String(input) : input.trim().replace(/[$,\s]/g, "");
  if (!raw || !/^\d+(\.\d{0,2})?$/.test(raw)) return null;
  return Math.round(Number(raw) * 100);
}

export function centsToPesosInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const TZ = "America/Mexico_City";

/** "4 de septiembre, 2026" a partir de un ISO en UTC. */
export function formatDate(iso: string): string {
  const key = dayKey(iso);
  const [y, m, d] = key.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}, ${y}`;
}

/** "Hoy 10:32 a.m." · "Ayer 4:10 p.m." · "4 sep 9:15 a.m." */
export function formatDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("es-MX", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  const day = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());

  if (day === today) return `Hoy ${time}`;
  if (day === yesterday) return `Ayer ${time}`;

  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${time}`;
}

/** YYYY-MM-DD en hora de Mexico, no en UTC: si no, el dia brinca a las 6 PM. */
export function dayKey(iso: string, tz: string = TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Suma dias a un YYYY-MM-DD sin salir del calendario civil. */
export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + delta * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** "24 ago" — para los ejes de las graficas. */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** Saludo segun la hora local. */
export function greeting(date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(date)
  );
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Texto libre a slug de URL. Los acentos se descomponen con NFD y se quitan
 * las marcas diacriticas (rango U+0300–U+036F), para que "María" sea "maria".
 */
const DIACRITICS = new RegExp("[̀-ͯ]", "g");

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
