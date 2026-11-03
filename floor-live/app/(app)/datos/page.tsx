import { redirect } from "next/navigation";
import { ImportPanel } from "@/components/admin/ImportPanel";
import { PageHead } from "@/components/admin/Kpi";
import { RelTime } from "@/components/client";
import { UndoImport } from "@/components/admin/UndoImport";
import { aiAvailable } from "@/lib/ai";
import { all } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { pageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getDict()).data.title };
}

export default async function DataPage() {
  const user = await pageUser();
  if (user.role !== "admin") redirect("/");
  const d = await getDict();
  const history = await all<{
    id: number;
    filename: string;
    year: number;
    rows_in: number;
    rows_new: number;
    rows_updated: number;
    first_week: number | null;
    last_week: number | null;
    created_at: string;
    uploader: string | null;
  }>(
    `SELECT i.*, u.name AS uploader FROM imports i LEFT JOIN users u ON u.id = i.created_by
      WHERE i.rows_in > 0 ORDER BY i.created_at DESC LIMIT 12`
  );

  return (
    <>
      <PageHead title={d.data.title} subtitle={d.data.subtitle} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ImportPanel aiReady={await aiAvailable()} />
        <aside className="flex flex-col gap-4">
          <div className="panel p-5">
            <h2 className="font-stencil text-sm font-extrabold uppercase tracking-[0.12em] text-red-text">{d.data.howTitle}</h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-ink-soft">
              <li>{d.data.howFpy}</li>
              <li>{d.data.howEff}</li>
              <li>{d.data.howSum}</li>
            </ul>
          </div>
          <div className="panel p-5">
            <h2 className="text-[0.9375rem] font-semibold">{d.data.history}</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">{d.data.noHistory}</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {history.map((h) => (
                  <li key={h.id} className="py-2.5 text-sm">
                    <div className="truncate font-medium">{h.filename}</div>
                    <div className="text-xs text-ink-faint">
                      <RelTime iso={h.created_at} /> · {h.uploader ?? "—"} · {h.year} {d.data.weeks(h.first_week, h.last_week)}
                    </div>
                    <div className="text-xs text-ink-soft">
                      {d.data.rows(h.rows_in)} · {d.data.done(h.rows_new, h.rows_updated).replace(/^[^:]+:\s*/, "")}
                    </div>
                    <UndoImport id={h.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
