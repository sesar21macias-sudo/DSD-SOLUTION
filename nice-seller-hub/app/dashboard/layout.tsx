import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export const metadata: Metadata = { title: { default: "Panel", template: "%s · Panel NICE" } };
export const dynamic = "force-dynamic";

/**
 * El panel. El middleware ya bloqueo a los anonimos, pero aqui se vuelve a
 * pedir la sesion: es de donde sale el `sellerId` que usan todas las consultas
 * de adentro, y una capa que confia en otra capa acaba siendo una capa sola.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireSeller();
  } catch {
    redirect("/login?volver=/dashboard");
  }

  return (
    <div className="min-h-dvh lg:flex">
      <DashboardNav
        businessName={session.seller.businessName}
        slug={session.seller.slug}
        profileImage={session.seller.profileImage}
      />
      <div className="flex-1 pb-24 lg:pb-0">{children}</div>
    </div>
  );
}
