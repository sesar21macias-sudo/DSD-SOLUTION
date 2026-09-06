"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ExternalLink,
  Home,
  Package,
  QrCode,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { LogoLockup } from "@/components/Logo";

/**
 * La navegacion del panel.
 *
 * En el telefono son cinco accesos abajo, al alcance del pulgar: son las cinco
 * cosas que una distribuidora hace mientras atiende —ver como va, tocar el
 * inventario, revisar pedidos, registrar una venta, buscar a una clienta—.
 * El resto vive en el menu completo del escritorio y en Configuración.
 */

const ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: Home, primary: true },
  { href: "/dashboard/inventory", label: "Inventario", icon: Package, primary: true },
  { href: "/dashboard/orders", label: "Pedidos", icon: ShoppingBag, primary: true },
  { href: "/dashboard/sales", label: "Ventas", icon: Wallet, primary: true },
  { href: "/dashboard/customers", label: "Clientes", icon: Users, primary: true },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, primary: false },
  { href: "/dashboard/qr", label: "Códigos QR", icon: QrCode, primary: false },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings, primary: false },
];

export function DashboardNav({
  businessName,
  slug,
  profileImage,
}: {
  businessName: string;
  slug: string;
  profileImage: string | null;
}) {
  const pathname = usePathname();

  // "/dashboard" solo esta activo en si mismo; los demas tambien en sus hijos.
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-3 pb-6">
          <LogoLockup />
        </div>

        <nav className="flex-1 space-y-0.5">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors ${
                isActive(item.href)
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:bg-line/60 hover:text-ink"
              }`}
            >
              <item.icon size={17} strokeWidth={1.7} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          <Link
            href={`/${slug}`}
            target="_blank"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-mute transition-colors hover:bg-line/60 hover:text-ink"
          >
            <ExternalLink size={15} strokeWidth={1.7} />
            Ver mi tienda
          </Link>

          <div className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2">
            <Avatar name={businessName} src={profileImage} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{businessName}</span>
          </div>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-mute transition-colors hover:bg-line/60 hover:text-ink"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Movil: cabecera */}
      <header className="safe-top sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-5 backdrop-blur-xl lg:hidden">
        <LogoLockup />
        <div className="flex items-center gap-1">
          <Link
            href={`/${slug}`}
            target="_blank"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-line/60"
            aria-label="Ver mi tienda"
          >
            <ExternalLink size={16} strokeWidth={1.7} />
          </Link>
          <Link
            href="/dashboard/settings"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-line/60"
            aria-label="Configuración"
          >
            <Settings size={17} strokeWidth={1.7} />
          </Link>
        </div>
      </header>

      {/* Movil: barra inferior */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl lg:hidden">
        <div className="flex">
          {ITEMS.filter((i) => i.primary).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? "text-ink" : "text-mute-soft"
                }`}
              >
                <item.icon size={20} strokeWidth={active ? 2 : 1.6} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold-soft text-[11px] font-medium text-gold">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
