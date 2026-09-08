import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { NewSellerForm } from "@/components/admin/NewSellerForm";

export const metadata: Metadata = { title: "Nueva distribuidora" };
export const dynamic = "force-dynamic";

export default async function NewSellerPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Link
        href="/admin/sellers"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-mute hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Distribuidoras
      </Link>

      <h1 className="mt-4 text-[26px] font-light">Nueva distribuidora</h1>
      <p className="mt-1 text-[13px] text-mute">
        Úsalo cuando alguien ya te pagó. La contraseña la genera el sistema.
      </p>

      <div className="mt-6">
        <NewSellerForm />
      </div>
    </main>
  );
}
