import { redirect } from "next/navigation";
import { Player } from "@/components/tv/Player";
import { getLang } from "@/lib/i18n/server";
import { internalPath } from "@/lib/safe-path";
import { canView, pageUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vista" };

/** Cualquier pantalla a tamaño completo, con sesión: ?team=<id>&lang=es|en */
export default async function PreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await pageUser();
  const sp = await searchParams;
  const team = sp.team ? Number(sp.team) : null;
  if (team !== null && (!Number.isInteger(team) || !canView(user, team))) redirect("/");
  const lang = sp.lang === "es" || sp.lang === "en" ? sp.lang : await getLang();
  const back = internalPath(sp.back) ?? "/";
  // Cuenta de pantalla: se comporta como tele (sin botón de salir, no se duerme, recarga sola).
  const kiosk = user.display_only === 1;
  return <Player mode={{ source: "preview", team, lang, back: kiosk ? null : back, kiosk }} initialLang={lang} />;
}
