/**
 * Archivos para abrir en Excel.
 *
 * Se genera CSV y no un .xlsx de verdad: un xlsx es un ZIP con varios XML
 * dentro, y armarlo en un Worker significa meter una libreria de cientos de
 * kilobytes al bundle para producir un archivo que Excel abre exactamente
 * igual que este. Cuando alguien pida formatos, formulas o varias hojas, ese
 * sera el momento de pagar ese precio.
 *
 * Dos decisiones que parecen detalles y son la diferencia entre un archivo que
 * se abre bien de doble clic y uno que llega hecho un desastre:
 *
 * - **Separador punto y coma.** Excel en español usa el punto y coma como
 *   separador de listas. Con comas, todo el renglón aterriza en la columna A.
 * - **BOM al inicio.** Sin él, Excel en Windows lee el archivo como ANSI y
 *   "María Gutiérrez" se convierte en "MarÃ­a GutiÃ©rrez".
 *
 * Y por lo mismo los números van con coma decimal: es lo que Excel en español
 * reconoce como número y no como texto.
 */

const SEP = ";";
// Se construye desde su codigo y no se escribe literal: el BOM es un caracter
// invisible, y cualquiera lo borraria de un editor sin darse cuenta de que
// acaba de romper los acentos de todos los reportes.
const BOM = String.fromCharCode(0xfeff);

export type CsvValue = string | number | null | undefined;

/**
 * Escapa una celda.
 *
 * Un valor que empieza con `=`, `+`, `-` o `@` se prefija con un apóstrofo:
 * Excel lo interpretaría como fórmula, y un nombre de cliente como "=cmd" es
 * una inyección de fórmula de manual. El apóstrofo no se ve en la celda.
 */
function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value).replace(".", ",");
  }

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (text.includes(SEP) || text.includes('"') || /[\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Centavos a un número que Excel entiende: 109900 → "1099,00". */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** ISO a "07/09/2026 14:32", que es como se lee una fecha en México. */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  // `formatToParts` en vez de `format`: el formato corto de es-MX mete una
  // coma entre la fecha y la hora, y una coma dentro de una celda de un
  // archivo que ya usa punto y coma solo confunde a quien lo abre.
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(cell).join(SEP)];
  for (const row of rows) lines.push(row.map(cell).join(SEP));
  // CRLF: es lo que espera Excel en Windows, que es donde se va a abrir.
  return BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Un nombre de archivo que se pueda guardar en cualquier sistema y que diga
 * de qué tienda y de qué día es sin tener que abrirlo.
 */
export function csvFilename(slug: string, kind: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const safe = `${slug}-${kind}-${day}`.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${safe}.csv`;
}

export function csvResponse(content: string, filename: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Un reporte descargado no debe quedarse en ninguna caché intermedia:
      // trae nombres y teléfonos de clientas.
      "Cache-Control": "no-store, private",
    },
  });
}
