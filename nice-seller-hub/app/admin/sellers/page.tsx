import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { listSellers, setSellerStatus } from "@/lib/admin";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { Card } from "@/components/ui";
import { ResetLinkButton } from "@/components/admin/ResetLinkButton";

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

export default async function AdminSellersPage() {
  await requireAdmin();
  const sellers = await listSellers();

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-[28px] font-light">Distribuidoras</h1>
      <p className="mt-1 text-[13px] text-mute">{sellers.length} en total</p>

      <Card className="mt-6 divide-y divide-line">
        {sellers.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
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
              </div>
              <p className="text-[11px] text-mute">
                /{s.slug}
                {s.city ? ` · ${s.city}` : ""} · desde {formatDate(s.createdAt)}
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
        ))}
      </Card>
    </main>
  );
}
