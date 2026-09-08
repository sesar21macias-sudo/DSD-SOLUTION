import { QrCode, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { requireSeller } from "@/lib/session";
import { listInventory } from "@/lib/seller";
import { getProgram } from "@/lib/loyalty";
import { codeToParam } from "@/lib/nice-code";
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
  const [items, program] = await Promise.all([listInventory(seller.id), getProgram(seller.id)]);

  // El dominio se toma del request: funciona igual en produccion, en una vista
  // previa de Cloudflare y en local, sin variable de entorno que mantener.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  /**
   * El QR del club es distinto a los de las piezas: no se pega en una etiqueta
   * sino que se enseña —en el mostrador, en una foto de Instagram, en la
   * bolsita de la entrega—. Por eso vive aparte y en grande, no dentro de la
   * cuadricula de etiquetas.
   */
  const clubUrl = `${origin}/${seller.slug}/club`;
  const clubSvg = program.enabled
    ? await QRCode.toString(clubUrl, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0b", light: "#00000000" },
      })
    : null;

  const codes = await Promise.all(
    items.map(async (item) => {
      const url = `${origin}/${seller.slug}/product/${codeToParam(item.niceCode)}`;
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

      {clubSvg && (
        <section className="no-print mb-8 flex items-center gap-5 rounded-2xl border border-gold/30 bg-gold-soft/40 p-5">
          <div
            className="h-28 w-28 shrink-0 rounded-xl bg-white p-2.5 shadow-card [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: clubSvg }}
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.16em] text-gold">
              <Sparkles size={12} strokeWidth={2} />
              {program.name}
            </p>
            <p className="mt-1.5 text-[15px] font-medium">Para que se registren</p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-soft">
              Enséñalo al entregar un pedido o compártelo en tus redes. Se registran con su nombre
              y su teléfono, y desde ahí ven sus puntos.
            </p>
            <p className="mt-2 break-all text-[11px] text-mute">{clubUrl}</p>
          </div>
        </section>
      )}

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
