import Link from "next/link";
import { revalidatePath } from "next/cache";
import { UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listSellers, setSellerStatus } from "@/lib/admin";
import { markSellerPaid } from "@/app/admin/sellers/actions";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { Card } from "@/components/ui";
import { ResetLinkButton } from "@/components/admin/ResetLinkButton";
import { ImpersonateButton } from "@/components/admin/ImpersonateButton";

export const dynamic = "force-dynamic";

/**
 * Esta es la unica pantalla del sistema donde se ven todas las tiendas juntas,
 * y es a proposito: ninguna distribuidora tiene por que ver el negocio de otra.
 *
 * Suspender una tienda apaga su enlace publico y el panel de quien la
 * administra —`getSellerBySlug` y `requireSeller` filtran por
 * `status = 'active'`—. Los datos no se borran.
 */
async function toggle(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = Number(formData.get("sellerId"));
  const status = String(formData.get("status"));
  if (!Number.isFinite(id) || (status !== "active" && status !== "suspended")) return;

  await setSellerStatus(id, status);
  revalidatePath("/admin/sellers");
}

async function markPaid(formData: FormData) {
  "use server";
  const id = Number(formData.get("sellerId"));
  if (!Number.isFinite(id)) return;
  await markSellerPaid(id);
  revalidatePath("/admin/sellers");
}

/** "trial" | "active" | "overdue" | "cancelled" contra la fecha real de pago. */
function planBadge(planStatus: string, paidUntil: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (paidUntil && paidUntil < today) {
    return { text: `Vencido desde ${formatDate(paidUntil)}`, className: "bg-red-50 text-red-600" };
  }
  if (planStatus === "active" && paidUntil) {
    return { text: `Pagado hasta ${formatDate(paidUntil)}`, className: "bg-emerald-50 text-emerald-700" };
  }
  return { text: "Sin pago registrado", className: "bg-amber-50 text-amber-700" };
}

export default async function AdminSellersPage() {
  await requireAdmin();
  const sellers = await listSellers();

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-light">Distribuidoras</h1>
          <p className="mt-1 text-[13px] text-mute">{sellers.length} en total</p>
        </div>
        <Link
          href="/admin/sellers/new"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-soft"
        >
          <UserPlus size={15} strokeWidth={1.9} />
          Nueva distribuidora
        </Link>
      </div>

      <Card className="mt-6 divide-y divide-line">
        {sellers.map((s) => {
          const badge = planBadge(s.planStatus, s.planPaidUntil);
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/${s.slug}`}
                    target="_blank"
                    className="truncate text-[15px] font-medium hover:underline"
                  >
                    {s.businessName}
                  </Link>
                  {s.status !== "active" && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                      Suspendida
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                    {badge.text}
                  </span>
                </div>
                <p className="text-[11px] text-mute">
                  /{s.slug}
                  {s.city ? ` · ${s.city}` : ""} · desde {formatDate(s.createdAt)}
                  {s.planPriceCents > 0 ? ` · ${formatMoney(s.planPriceCents)}/mes` : ""}
                </p>
              </div>

              <div className="flex items-center gap-5 text-right text-[12px] tabular-nums text-mute">
                <span>
                  <span className="block text-[14px] font-medium text-ink">
                    {formatNumber(s.products)}
                  </span>
                  piezas
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-ink">
                    {formatNumber(s.customers)}
                  </span>
                  clientes
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-ink">
                    {formatMoney(s.salesCents)}
                  </span>
                  ventas
                </span>
              </div>

              <form action={markPaid} className="shrink-0">
                <input type="hidden" name="sellerId" value={s.id} />
                <button
                  type="submit"
                  className="h-9 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-emerald-300 hover:text-emerald-700"
                >
                  Ya me pagó
                </button>
              </form>

              <div className="shrink-0">
                <ImpersonateButton sellerId={s.id} />
              </div>

              <div className="shrink-0">
                <ResetLinkButton
                  userId={s.userId}
                  businessName={s.businessName}
                  whatsapp={s.whatsapp}
                />
              </div>

              <form action={toggle} className="shrink-0">
                <input type="hidden" name="sellerId" value={s.id} />
                <input
                  type="hidden"
                  name="status"
                  value={s.status === "active" ? "suspended" : "active"}
                />
                <button
                  type="submit"
                  className={`h-9 rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${
                    s.status === "active"
                      ? "border-line-strong text-ink-soft hover:border-red-300 hover:text-red-600"
                      : "border-ink bg-ink text-white"
                  }`}
                >
                  {s.status === "active" ? "Suspender" : "Activar"}
                </button>
              </form>
            </div>
          );
        })}
      </Card>
    </main>
  );
}
