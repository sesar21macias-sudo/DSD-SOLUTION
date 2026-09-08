import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/session";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export const metadata: Metadata = { title: { default: "Panel", template: "%s · Panel" } };
export const dynamic = "force-dynamic";

/**
 * El panel. El middleware ya bloqueo a los anonimos, pero aqui se vuelve a
 * pedir la sesion: es de donde sale el `sellerId` que usan todas las consultas
 * de adentro, y una capa que confia en otra capa acaba siendo una capa sola.
 *
 * **Aqui NO va un `loading.tsx`.** Hubo uno y rompia el panel entero: el limite
 * de Suspense que crea se servia pospuesto (`$~` en el HTML) y el cliente nunca
 * lo resolvia, asi que en cualquier carga directa —abrir el enlace, recargar,
 * volver desde WhatsApp— React hidrataba el menu pero no el contenido. La
 * pagina se veia perfecta y ningun boton, campo ni formulario respondia.
 *
 * Solo se notaba al recargar: navegando dentro del panel el contenido se pinta
 * en el cliente y todo funciona, por eso paso desapercibido tanto tiempo.
 *
 * Si algun dia se quiere un esqueleto de carga, hay que comprobar antes que el
 * contenido siga hidratando en una carga directa. El esqueleto no vale un panel
 * muerto.
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
