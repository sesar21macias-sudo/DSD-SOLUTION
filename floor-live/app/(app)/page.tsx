import Link from "next/link";
import { InsightCard } from "@/components/admin/InsightCard";
import { KpiPanel, MiniRates, PageHead } from "@/components/admin/Kpi";
import { IconPlay, IconUpload } from "@/components/Icons";
import { Empty } from "@/components/ui";
import { all, first } from "@/lib/db";
import { daysSince } from "@/lib/dates";
import { getDict, getLang } from "@/lib/i18n/server";
import { loadYear, statsFor } from "@/lib/metrics";
import { getSettings } from "@/lib/settings";
import { pageUser } from "@/lib/session";
import { ruleSummary } from "@/lib/summary";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).nav.panel };
}

export default async function PanelPage() {
  const user = await pageUser();
  const [d, lang, s, data] = await Promise.all([getDict(), getLang(), getSettings(), loadYear()]);
  const teams = await all<Team>("SELECT * FROM teams WHERE active = 1 ORDER BY position, name");
  const isAdmin = user.role === "admin";
  const myTeam = user.team_id ? teams.find((t) => t.id === user.team_id) ?? null : null;
  const goals = { goalFpy: s.goalFpy, goalEff: s.goalEff, warnFpy: s.warnFpy, warnEff: s.warnEff };

  const scopeCode = isAdmin ? "plant" : myTeam?.code ?? "plant";
  const stats = data ? (isAdmin || !myTeam ? statsFor(data, "all") : statsFor(data, [myTeam.code])) : null;
  const insightRow =
    data && stats
      ? await first<{ text: string }>(
          "SELECT text FROM insights WHERE scope = ? AND year = ? AND week = ? AND lang = ?",
          scopeCode,
          data.year,
          data.week,
          lang
        )
      : null;
  const insight = stats ? insightRow?.text ?? ruleSummary(stats, s, lang, isAdmin ? (lang === "en" ? "The plant" : "La planta") : myTeam?.name ?? "") : null;

  const screens = isAdmin
    ? await first<{ n: number; online: number | null }>(
        "SELECT COUNT(*) AS n, SUM(CASE WHEN last_seen > ? THEN 1 ELSE 0 END) AS online FROM displays WHERE status = 'active'",
        new Date(Date.now() - 15 * 60_000).toISOString()
      ).then((r) => ({ all: r?.n ?? 0, on: r?.online ?? 0 }))
    : null;

  const previewHref = isAdmin ? "/vista?back=/" : `/vista?team=${user.team_id}&back=/`;
  const title = isAdmin ? d.panel.title : myTeam?.name ?? d.panel.title;

  return (
    <>
      <PageHead
        title={title}
        subtitle={data ? d.panel.subtitle(data.week, data.year) : undefined}
        action={
          <Link href={previewHref} className="btn btn-primary">
            <IconPlay size={16} />
            {isAdmin ? d.panel.openPlant : d.nav.myScreen}
          </Link>
        }
      />

      {!data || !stats ? (
        <Empty title={d.panel.empty}>
          <p>{d.panel.emptyBody}</p>
          {isAdmin && (
            <Link href="/datos" className="btn btn-light mt-5">
              <IconUpload size={16} />
              {d.panel.goUpload}
            </Link>
          )}
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
            <KpiPanel
              label={d.common.quality}
              value={stats.current.fpy}
              prev={stats.prev?.fpy ?? null}
              month={stats.monthRates.fpy}
              ytd={stats.ytd.fpy}
              goal={s.goalFpy}
              warn={s.warnFpy}
              d={d}
            />
            <KpiPanel
              label={d.common.efficiency}
              value={stats.current.eff}
              prev={stats.prev?.eff ?? null}
              month={stats.monthRates.eff}
              ytd={stats.ytd.eff}
              goal={s.goalEff}
              warn={s.warnEff}
              d={d}
              delayMs={60}
            />
            <div className="panel lit rise flex flex-col justify-between gap-4 p-5" style={{ animationDelay: "90ms" }}>
              <div>
                <div className="font-stencil text-[1.05rem] font-extrabold uppercase tracking-[0.1em]">{d.panel.safety}</div>
                {s.safetySince ? (
                  <div
                    className="led mt-2 text-[4.2rem]"
                    style={{ ["--u" as string]: "0.6rem" }}
                  >
                    {daysSince(s.safetySince)}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ink-faint">{d.panel.setSafety}</p>
                )}
              </div>
              {screens && (
                <Link href="/pantallas" className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-sm hover:bg-surface-3">
                  <span className="text-ink-soft">{d.panel.screens}</span>
                  <span className="flex items-center gap-2 font-medium">
                    {screens.on > 0 && <span className="live-dot" />}
                    {d.panel.screensOnline(screens.on, screens.all)}
                  </span>
                </Link>
              )}
            </div>
          </div>

          <InsightCard text={insight} canRegenerate={isAdmin} />

          {isAdmin && (
            <section className="mt-6">
              <h2 className="mb-3 text-[0.9375rem] font-semibold">{d.panel.teams}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {teams.map((t, k) => {
                  const ts = statsFor(data, [t.code]);
                  const worked = ts && ts.current.inspected > 0;
                  return (
                    <div key={t.id} className="panel lit rise flex flex-col gap-3 p-4" style={{ animationDelay: `${120 + k * 30}ms` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{t.name}</div>
                          <div className="truncate text-xs text-ink-faint">
                            <span className="font-mono">{t.code}</span>
                            {t.leader ? ` · ${t.leader}` : ""}
                          </div>
                        </div>
                        <Link href={`/vista?team=${t.id}&back=/`} className="btn btn-quiet btn-sm flex-none">
                          <IconPlay size={14} />
                          {d.common.preview}
                        </Link>
                      </div>
                      {worked ? (
                        <>
                          <MiniRates rates={ts.current} goals={goals} d={d} />
                          <div className="text-xs text-ink-faint">
                            {d.panel.units(ts.current.units)} · {d.panel.jobs(ts.current.jobs)}
                          </div>
                        </>
                      ) : (
                        <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-sm text-ink-faint">{d.panel.noJobs}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
