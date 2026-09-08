import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Ticket } from "lucide-react";
import { requireSeller } from "@/lib/session";
import { getProgram, listRedemptions, listRewards } from "@/lib/loyalty";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { LoyaltyProgramForm } from "@/components/dashboard/LoyaltyProgramForm";
import { RewardManager } from "@/components/dashboard/RewardManager";
import { RedemptionList } from "@/components/dashboard/RedemptionList";

export const metadata: Metadata = { title: "Club de puntos" };
export const dynamic = "force-dynamic";

/**
 * El club de esta distribuidora: sus reglas, sus recompensas y los cupones que
 * sus clientas ya canjearon.
 *
 * Los cupones vigentes van hasta arriba de su seccion porque son lo unico de
 * esta pantalla que tiene a alguien esperando del otro lado.
 */
export default async function LoyaltyPage() {
  const { seller } = await requireSeller();

  const [program, rewards, redemptions] = await Promise.all([
    getProgram(seller.id),
    listRewards(seller.id),
    listRedemptions(seller.id),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Club de puntos"
        subtitle="Tus clientas acumulan puntos contigo y los cambian por lo que tú decidas."
        action={
          program.enabled ? (
            <Link
              href={`/${seller.slug}/club`}
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium transition-colors hover:border-ink/25"
            >
              Ver cómo lo ven
              <ExternalLink size={13} strokeWidth={1.8} />
            </Link>
          ) : null
        }
      />

      <LoyaltyProgramForm program={program} slug={seller.slug} />

      <section className="mt-10">
        <RewardManager rewards={rewards} enabled={program.enabled} />
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold">
          <Ticket size={17} strokeWidth={1.8} className="text-mute" />
          Cupones canjeados
        </h2>
        <p className="mb-4 mt-1 text-[13px] text-mute">
          Cuando alguien te enseñe su código, búscalo aquí y márcalo como usado.
        </p>
        <RedemptionList redemptions={redemptions} />
      </section>
    </PageShell>
  );
}
