import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin NICE" } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    // El middleware ya filtro, pero si alguien llega aqui sin rol de admin
    // termina en su propio panel, no en un error.
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-5">
          <Link href="/admin" className="flex items-baseline gap-2">
            <Logo size="sm" />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-nice">
              Admin
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/admin" className="text-ink-soft transition-colors hover:text-ink">
              Resumen
            </Link>
            <Link href="/admin/sellers" className="text-ink-soft transition-colors hover:text-ink">
              Distribuidoras
            </Link>
          </nav>
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button type="submit" className="text-[13px] text-mute transition-colors hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
