import { redirect } from "next/navigation";
import { DisplaysManager } from "@/components/admin/DisplaysManager";
import { PageHead } from "@/components/admin/Kpi";
import { all } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { pageUser } from "@/lib/session";
import type { Display, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).displays.title };
}

export default async function DisplaysPage() {
  const user = await pageUser();
  if (user.role !== "admin") redirect("/");
  const d = await getDict();
  const [displays, teams] = await Promise.all([
    all<Display>(
      "SELECT id, name, status, scope, team_id, lang, slide_seconds, last_seen, created_at FROM displays WHERE status = 'active' ORDER BY name, id"
    ),
    all<Team>("SELECT * FROM teams WHERE active = 1 ORDER BY position, name"),
  ]);
  return (
    <>
      <PageHead title={d.displays.title} subtitle={d.displays.subtitle} />
      <DisplaysManager displays={displays} teams={teams} />
    </>
  );
}
