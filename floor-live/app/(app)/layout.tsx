import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { first } from "@/lib/db";
import { pageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  // Una cuenta de pantalla no tiene panel: va directo a su pantalla completa.
  if (user.display_only) redirect(user.team_id ? `/vista?team=${user.team_id}` : "/vista");
  const team = user.team_id ? await first<{ name: string }>("SELECT name FROM teams WHERE id = ?", user.team_id) : null;
  return (
    <Shell user={user} teamName={team?.name ?? null}>
      {children}
    </Shell>
  );
}
