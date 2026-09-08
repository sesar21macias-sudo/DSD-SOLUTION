import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Gift, Sparkles } from "lucide-react";
import { getSellerBySlug } from "@/lib/store";
import { getMember } from "@/lib/member";
import {
  getProgram,
  listCustomerRedemptions,
  listMovements,
  listRewards,
  pointsToNextTier,
  rateLabel,
  tierFor,
} from "@/lib/loyalty";
import { ClubJoinForm } from "@/components/store/ClubJoinForm";
import { ClubMember } from "@/components/store/ClubMember";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seller: string }>;
}): Promise<Metadata> {
  const { seller: slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) return { title: "Club" };
  const program = await getProgram(seller.id);
  return {
    title: `${program.name} | ${seller.businessName}`,
    description: `Acumula puntos con cada compra en ${seller.businessName} y cámbialos por recompensas.`,
  };
}

/**
 * El club, del lado de la clienta.
 *
 * Una sola pantalla con dos caras: si no tiene sesion ve de que se trata y el
 * formulario para entrar; si la tiene, ve su tarjeta, sus recompensas y sus
 * cupones. Partirlo en dos rutas obligaria a decidir a cual mandar a alguien
 * que llega desde un QR, y la respuesta siempre seria "depende".
 */
export default async function ClubPage({ params }: { params: Promise<{ seller: string }> }) {
  const { seller: slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  const program = await getProgram(seller.id);

  if (!program.enabled) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <EmptyState
          icon={<Gift size={30} strokeWidth={1.3} />}
          title="Esta tienda todavía no tiene club de puntos"
          description={`${seller.businessName} aún no lo activó. Mientras tanto, puedes seguir haciendo tus pedidos por WhatsApp.`}
        />
      </main>
    );
  }

  const rewards = await listRewards(seller.id, true);
  const member = await getMember(seller.id);

  if (!member) {
    return (
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-4">
        <div className="animate-fade-up">
          <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-gold">
            <Sparkles size={12} strokeWidth={2} />
            {program.name}
          </p>
          <h1 className="mt-3 font-display text-[34px] font-normal leading-[1.1]">
            Cada compra
            <br />
            te acerca a algo.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-mute">
            {rateLabel(program.centsPerPoint)} que compres con {seller.businessName}. Junta puntos
            y cámbialos por recompensas.
            {program.welcomePoints > 0
              ? ` Empiezas con ${program.welcomePoints} puntos de regalo.`
              : ""}
          </p>
        </div>

        {rewards.length > 0 && (
          <ul className="stagger mt-8 space-y-2.5">
            {rewards.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
                  <Gift size={17} strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{r.name}</p>
                  {r.description && (
                    <p className="mt-0.5 text-[12px] leading-snug text-mute">{r.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-gold">
                  {r.pointsCost} pts
                </span>
              </li>
            ))}
          </ul>
        )}

        <ClubJoinForm slug={slug} businessName={seller.businessName} terms={program.terms} />
      </main>
    );
  }

  const [redemptions, movements] = await Promise.all([
    listCustomerRedemptions(seller.id, member.customer.id),
    listMovements(seller.id, member.customer.id, 12),
  ]);

  return (
    <ClubMember
      slug={slug}
      programName={program.name}
      rateText={rateLabel(program.centsPerPoint)}
      terms={program.terms}
      businessName={seller.businessName}
      whatsapp={seller.whatsapp}
      couponMessageTemplate={seller.couponMessageTemplate}
      customerName={member.customer.name}
      points={member.points}
      tier={tierFor(member.lifetimePoints)}
      next={pointsToNextTier(member.lifetimePoints)}
      lifetimePoints={member.lifetimePoints}
      rewards={rewards.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        pointsCost: r.pointsCost,
        kind: r.kind,
        value: r.value,
      }))}
      redemptions={redemptions.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.nameSnapshot,
        status: r.status,
        createdAt: r.createdAt,
      }))}
      movements={movements.map((m) => ({
        id: m.id,
        points: m.points,
        description: m.description,
        createdAt: m.createdAt,
      }))}
    />
  );
}
