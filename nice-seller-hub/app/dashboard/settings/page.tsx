import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { PageHeader, PageShell } from "@/components/dashboard/PageHeader";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, seller } = await requireSeller();

  return (
    <PageShell>
      <PageHeader
        title="Configuración"
        subtitle="Así te ven tus clientes cuando abren tu enlace."
      />
      <ProfileForm seller={seller} email={user.email} />
    </PageShell>
  );
}
