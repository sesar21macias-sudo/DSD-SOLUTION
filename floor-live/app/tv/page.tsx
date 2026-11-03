import { Player } from "@/components/tv/Player";
import { getLang } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "TV" };

/** La página que se abre en cada tele. Sin sesión: se autentica con la cookie de pantalla. */
export default async function TvPage() {
  return <Player mode={{ source: "tv" }} initialLang={await getLang()} />;
}
