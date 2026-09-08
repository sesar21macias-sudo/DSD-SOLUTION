"use client";

import { Download } from "lucide-react";

/**
 * Descargar para Excel.
 *
 * Es un enlace normal, no un fetch: el navegador sabe descargar un archivo que
 * llega con `Content-Disposition`, y hacerlo a mano —fetch, blob, un `<a>`
 * inventado— agrega código y falla en los navegadores de iOS, que es justo
 * donde estas distribuidoras trabajan.
 */
export function ExportButton({
  tipo,
  rango,
  label = "Descargar",
}: {
  tipo: "ventas" | "inventario" | "clientes" | "pedidos" | "abonos";
  /** Solo aplica al reporte de ventas; los demás salen completos. */
  rango?: string;
  label?: string;
}) {
  const href = `/api/dashboard/export?tipo=${tipo}${rango ? `&rango=${rango}` : ""}`;

  return (
    <a
      href={href}
      download
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium transition-colors hover:border-ink/25"
    >
      <Download size={14} strokeWidth={1.9} />
      {label}
    </a>
  );
}
