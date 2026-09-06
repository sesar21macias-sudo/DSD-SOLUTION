import type { Metadata } from "next";
import Link from "next/link";
import { requireSeller } from "@/lib/session";
import { listOpenReceptions } from "@/lib/receptions";
import { formatDateTime } from "@/lib/format";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { ReceiveCapture } from "@/components/dashboard/ReceiveCapture";

export const metadata: Metadata = { title: "Recibir mercancía" };
export const dynamic = "force-dynamic";

export default async function ReceivePage() {
  const { seller } = await requireSeller();
  const open = await listOpenReceptions(seller.id);

  return (
    <PageShell>
      <PageHeader
        title="Recibir mercancía"
        subtitle="Toma una foto de tu ticket NICE y cargamos las piezas por ti."
      />

      {open.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-[13px] font-medium text-ink-soft">
            Tienes recepciones a medias
          </p>
          <ul className="space-y-2">
            {open.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/inventory/receive/${r.id}`}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-px"
                >
                  <span className="text-[14px] font-medium">
                    {r.items} {r.items === 1 ? "renglón" : "renglones"} sin confirmar
                  </span>
                  <span className="text-[12px] text-mute">{formatDateTime(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReceiveCapture />
    </PageShell>
  );
}
