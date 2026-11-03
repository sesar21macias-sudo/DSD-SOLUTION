"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/lib/types";
import { BeaufortLogo } from "./BrandMark";
import { useDict } from "./I18n";
import { IconMegaphone, IconPanel, IconTeam, IconTv, IconUpload } from "./Icons";
import { Spotlight, Toaster } from "./client";
import { Avatar, cx } from "./ui";

type NavKey = "panel" | "data" | "content" | "displays" | "teams" | "myScreen";

function navFor(user: User): { href: string; key: NavKey; icon: (p: { size?: number; className?: string }) => React.ReactNode }[] {
  if (user.role === "admin") {
    return [
      { href: "/", key: "panel", icon: IconPanel },
      { href: "/datos", key: "data", icon: IconUpload },
      { href: "/contenido", key: "content", icon: IconMegaphone },
      { href: "/pantallas", key: "displays", icon: IconTv },
      { href: "/equipos", key: "teams", icon: IconTeam },
    ];
  }
  return [
    { href: "/", key: "panel", icon: IconPanel },
    { href: "/contenido", key: "content", icon: IconMegaphone },
    { href: `/vista?team=${user.team_id ?? ""}`, key: "myScreen", icon: IconTv },
  ];
}

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex flex-col gap-1.5 leading-none", className)}>
      <BeaufortLogo className="h-[22px] w-auto" />
      <span className="font-stencil text-[0.62rem] font-bold uppercase tracking-[0.3em] text-ink-faint">Floor Live</span>
    </span>
  );
}

export function Shell({ user, teamName, children }: { user: User; teamName: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const d = useDict();
  const nav = navFor(user);
  const roleLabel = user.role === "admin" ? d.common.admin : teamName ? `${d.common.leader} · ${teamName}` : d.common.leader;

  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden="true" />
      <Spotlight />

      {/* Barra lateral (escritorio) */}
      <aside
        className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-bg/60 px-3 py-5 md:flex"
        style={{ zIndex: "var(--z-nav)" }}
      >
        <Link href="/" className="mb-8 px-3">
          <Wordmark />
        </Link>
        <nav aria-label={d.nav.main} className="flex flex-col gap-0.5">
          {nav.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[0.9rem] transition-colors",
                  active ? "bg-surface-2 font-medium text-ink" : "text-ink-soft hover:bg-surface hover:text-ink"
                )}
              >
                <Icon size={19} className={active ? "text-red-text" : undefined} />
                {d.nav[key]}
              </Link>
            );
          })}
        </nav>

        <span className="mt-auto" />

        <Link
          href="/cuenta"
          className={cx(
            "flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface",
            pathname === "/cuenta" && "bg-surface-2"
          )}
        >
          <Avatar name={user.name} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-ink-faint">{roleLabel}</span>
          </span>
        </Link>
      </aside>

      {/* Encabezado (teléfono) */}
      <header
        className="sticky top-0 flex items-center justify-between border-b border-line px-4 pb-3 tabbar md:hidden"
        style={{ zIndex: "var(--z-sticky)", paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link href="/">
          <Wordmark />
        </Link>
        <Link href="/cuenta" aria-label={d.nav.account}>
          <Avatar name={user.name} size={32} />
        </Link>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-[1240px] px-4 pb-32 pt-6 md:pl-[17rem] md:pr-8 md:pt-10 md:pb-16">
        {children}
      </main>

      {/* Pestañas (teléfono) */}
      <nav
        aria-label={d.nav.main}
        className="tabbar fixed inset-x-0 bottom-0 grid border-t border-line md:hidden"
        style={{ zIndex: "var(--z-nav)", paddingBottom: "env(safe-area-inset-bottom)", gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}
      >
        {nav.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[0.66rem] font-medium transition-colors",
                active ? "text-ink" : "text-ink-faint"
              )}
            >
              <Icon size={22} className={active ? "text-red-text" : undefined} />
              <span className="max-w-full truncate px-1">{d.nav[key]}</span>
            </Link>
          );
        })}
      </nav>

      <Toaster />
    </div>
  );
}
