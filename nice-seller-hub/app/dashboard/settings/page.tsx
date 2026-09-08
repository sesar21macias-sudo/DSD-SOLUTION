import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Sparkles } from "lucide-react";
import { requireSeller } from "@/lib/session";
import { getProgram } from "@/lib/loyalty";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { MessageTemplatesForm } from "@/components/dashboard/MessageTemplatesForm";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, seller } = await requireSeller();
  const program = await getProgram(seller.id);

  return (
    <PageShell>
      <PageHeader
        title="Configuración"
        subtitle="Así te ven tus clientes cuando abren tu enlace."
      />
      {/* El club vive en su propia pantalla —tiene recompensas y cupones— pero
          se anuncia aqui porque Configuracion es donde se busca "los ajustes de
          mi tienda". */}
      <Link
        href="/dashboard/loyalty"
        className="group mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-gold/40"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
          <Sparkles size={17} strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{program.name}</span>
          <span className="block text-[12px] text-mute">
            {program.enabled
              ? "Activo. Ajusta la tasa de puntos y tus recompensas."
              : "Apagado. Enciéndelo para que tus clientas acumulen puntos."}
          </span>
        </span>
        <ArrowRight
          size={16}
          strokeWidth={1.8}
          className="shrink-0 text-mute-soft transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink"
        />
      </Link>

      <ProfileForm seller={seller} email={user.email} />

      <section className="mt-10 max-w-lg border-t border-line pt-8">
        <SectionTitle>Mensajes de WhatsApp</SectionTitle>
        <p className="mb-5 -mt-2 text-[13px] text-mute">
          Cómo se escuchan los mensajes que arma el sistema. Los precios, el folio y los totales
          siempre son exactos, los ponga como los ponga.
        </p>
        <MessageTemplatesForm
          templates={{
            orderGreeting: seller.orderGreetingTemplate,
            orderClosing: seller.orderClosingTemplate,
            shareMessage: seller.shareMessageTemplate,
            paymentReminder: seller.paymentReminderTemplate,
            couponMessage: seller.couponMessageTemplate,
            pointsGreeting: seller.pointsGreetingTemplate,
            pointsClosing: seller.pointsClosingTemplate,
          }}
        />
      </section>
    </PageShell>
  );
}
