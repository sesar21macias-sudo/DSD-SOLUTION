/**
 * Lector mínimo de .xlsx para el navegador, sin dependencias.
 *
 * Un .xlsx es un ZIP con XML adentro. Aquí solo se lee lo necesario: la primera
 * hoja y la tabla de textos compartidos. Se descomprime con DecompressionStream
 * (nativo) y se parsea con DOMParser. Evita traer SheetJS desde npm, cuya versión
 * publicada ahí tiene vulnerabilidades conocidas y ya no recibe parches.
 *
 * Topes contra archivos hostiles: 25 MB de archivo y 60 MB descomprimido por parte.
 */

const MAX_FILE = 25 * 1024 * 1024;
const MAX_PART = 60 * 1024 * 1024;

type Cell = string | number | null;

interface Entry {
  name: string;
  method: number;
  compSize: number;
  offset: number;
}

function readEntries(buf: ArrayBuffer): Map<string, Entry> {
  const v = new DataView(buf);
  // Fin del directorio central: firma 0x06054b50, buscando desde el final.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66_000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Entry>();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip");
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out.set(name, { name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readPart(buf: ArrayBuffer, e: Entry): Promise<string> {
  const v = new DataView(buf);
  if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error("bad entry");
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const data = new Uint8Array(buf, start, e.compSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("unsupported compression");

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PART) {
      await reader.cancel();
      throw new Error("too big");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

function xml(s: string): Document {
  const doc = new DOMParser().parseFromString(s, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("bad xml");
  return doc;
}

/** Texto de un <si> o <is>, sin la guía fonética (<rPh>). */
function richText(el: Element): string {
  let s = "";
  for (const t of Array.from(el.getElementsByTagName("t"))) {
    if (t.parentElement?.localName === "rPh") continue;
    s += t.textContent ?? "";
  }
  return s;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Primera hoja del libro como renglones de celdas. */
export async function readXlsx(file: File): Promise<Cell[][]> {
  if (file.size > MAX_FILE) throw new Error("too big");
  const buf = await file.arrayBuffer();
  const entries = readEntries(buf);
  const get = async (name: string) => {
    const e = entries.get(name);
    return e ? readPart(buf, e) : null;
  };

  // Cuál es la primera hoja: workbook.xml → r:id → rels → archivo.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await get("xl/workbook.xml");
  const rels = await get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName("sheet")[0];
    const rid = first?.getAttribute("r:id") ?? first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const rel = Array.from(xml(rels).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }

  const sstXml = await get("xl/sharedStrings.xml");
  const shared = sstXml ? Array.from(xml(sstXml).getElementsByTagName("si")).map(richText) : [];

  const sheetXml = await get(sheetPath);
  if (!sheetXml) throw new Error("no sheet");
  const rows: Cell[][] = [];
  for (const row of Array.from(xml(sheetXml).getElementsByTagName("row"))) {
    const cells: Cell[] = [];
    let next = 0;
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r");
      const idx = ref ? colIndex(ref) : next;
      next = idx + 1;
      const t = c.getAttribute("t");
      const raw = c.getElementsByTagName("v")[0]?.textContent ?? null;
      let val: Cell = null;
      if (t === "s") val = raw === null ? null : shared[Number(raw)] ?? null;
      else if (t === "inlineStr") {
        const is = c.getElementsByTagName("is")[0];
        val = is ? richText(is) : null;
      } else if (t === "str" || t === "e") val = raw;
      else if (t === "b") val = raw === "1" ? 1 : 0;
      else val = raw === null || raw === "" ? null : Number(raw);
      cells[idx] = val;
    }
    rows.push(Array.from(cells, (x) => (x === undefined ? null : x)));
  }
  return rows;
}

/** CSV sencillo (comas o punto y coma, comillas dobles). */
export async function readCsv(file: File): Promise<Cell[][]> {
  if (file.size > MAX_FILE) throw new Error("too big");
  const text = (await file.text()).replace(/^﻿/, "");
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cur = "";
  let quoted = false;
  const push = () => {
    const s = cur.trim();
    row.push(s === "" ? null : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s);
    cur = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) push();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      push();
      rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur || row.length) {
    push();
    rows.push(row);
  }
  return rows;
}
