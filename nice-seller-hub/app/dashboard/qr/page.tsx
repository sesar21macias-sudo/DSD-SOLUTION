import { QrCode } from "lucide-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { requireSeller } from "@/lib/session";
import { listInventory } from "@/lib/seller";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { QrSheet } from "@/components/dashboard/QrSheet";
import { EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Códigos QR" };
export const dynamic = "force-dynamic";

/**
 * Un QR por pieza, apuntando a la URL de esa pieza **en esta tienda**. El
 * mismo collar 826031 genera un QR distinto para cada distribuidora: quien lo
 * escanee tiene que llegar al precio y las existencias de quien le puso la
 * etiqueta, no a las de otra persona.
 *
 * Los SVG se generan en el servidor para que la impresion salga vectorial y se
 * vea nitida en una etiqueta chica.
 */
export default async function QrPage() {
  const { seller } = await requireSeller();
  const items = await listInventory(seller.id);

  // El dominio se toma del request: funciona igual en produccion, en una vista
  // previa de Cloudflare y en local, sin variable de entorno que mantener.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const codes = await Promise.all(
    items.map(async (item) => {
      const url = `${origin}/${seller.slug}/product/${item.niceCode}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0b", light: "#00000000" },
      });
      return {
        inventoryId: item.inventoryId,
        niceCode: item.niceCode,
        name: item.name,
        priceCents: item.priceCents,
        url,
        svg,
      };
    })
  );

  return (
    <PageShell>
      <PageHeader
        title="Códigos QR"
        subtitle="Imprímelos y pégalos en tus piezas. Cada uno lleva a tu tienda."
      />

      {codes.length === 0 ? (
        <EmptyState
          icon={<QrCode size={30} strokeWidth={1.3} />}
          title="Todavía no hay piezas que etiquetar"
          description="Agrega piezas a tu inventario y aquí podrás generar e imprimir sus códigos."
          action={<LinkButton href="/dashboard/inventory/new">Agregar una pieza</LinkButton>}
        />
      ) : (
        <QrSheet codes={codes} businessName={seller.businessName} />
      )}
    </PageShell>
  );
}
