import { ContentManager } from "@/components/admin/ContentManager";
import { PageHead } from "@/components/admin/Kpi";
import { aiAvailable } from "@/lib/ai";
import { all } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { pageUser } from "@/lib/session";
import type { Announcement, Media, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).content.title };
}

export default async function ContentPage() {
  const user = await pageUser();
  const d = await getDict();
  const isAdmin = user.role === "admin";
  const teams = await all<Team>("SELECT * FROM teams ORDER BY position, name");

  // El líder ve y administra solo lo de su equipo.
  const [announcements, media] = isAdmin
    ? await Promise.all([
        all<Announcement>("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 200"),
        all<Media>("SELECT id, team_id, width, height, caption, in_rotation, starts_at, ends_at, created_at FROM media ORDER BY created_at DESC LIMIT 200"),
      ])
    : await Promise.all([
        all<Announcement>("SELECT * FROM announcements WHERE team_id = ? ORDER BY created_at DESC LIMIT 200", user.team_id),
        all<Media>(
          "SELECT id, team_id, width, height, caption, in_rotation, starts_at, ends_at, created_at FROM media WHERE team_id = ? ORDER BY created_at DESC LIMIT 200",
          user.team_id
        ),
      ]);

  const scopes = isAdmin
    ? [{ id: null, label: d.common.wholePlant }, ...teams.filter((t) => t.active).map((t) => ({ id: t.id, label: t.name }))]
    : teams.filter((t) => t.id === user.team_id).map((t) => ({ id: t.id, label: t.name }));

  return (
    <>
      <PageHead title={d.content.title} subtitle={d.content.subtitle} />
      <ContentManager
        announcements={announcements}
        media={media}
        scopes={scopes}
        teamNames={Object.fromEntries(teams.map((t) => [t.id, t.name]))}
        aiReady={await aiAvailable()}
      />
    </>
  );
}
