import { redirect } from "next/navigation";
import { PageHead } from "@/components/admin/Kpi";
import { AccountsManager, SettingsForm, TeamsTable, type AccountRow } from "@/components/admin/TeamsManager";
import { all } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).teams.title };
}

export default async function TeamsPage() {
  const user = await pageUser();
  if (user.role !== "admin") redirect("/");
  const [d, teams, accounts, settings] = await Promise.all([
    getDict(),
    all<Team>("SELECT * FROM teams ORDER BY position, name"),
    all<AccountRow>("SELECT id, username, name, role, team_id, active, display_only FROM users ORDER BY role, display_only, name"),
    getSettings(),
  ]);

  return (
    <>
      <PageHead title={d.teams.title} subtitle={d.teams.subtitle} />
      <div className="flex flex-col gap-10">
        <TeamsTable teams={teams} />

        <section className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div>
            <h2 className="font-display text-[1.8rem] leading-none">{d.teams.accounts}</h2>
            <p className="mt-2 text-sm text-ink-soft">{d.teams.accountsBody}</p>
          </div>
          <AccountsManager accounts={accounts} teams={teams.filter((t) => t.active)} meId={user.id} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div>
            <h2 className="font-display text-[1.8rem] leading-none">{d.teams.goals}</h2>
            <p className="mt-2 text-sm text-ink-soft">{d.teams.goalsBody}</p>
          </div>
          <SettingsForm settings={settings} />
        </section>
      </div>
    </>
  );
}
