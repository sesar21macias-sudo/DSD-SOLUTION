'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/auth'
import { useSocket } from '@/hooks/useSocket'
import { DSDLogo } from '@/components/DSDLogo'
import { BusinessAssistant } from '@/components/BusinessAssistant'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/useT'
import {
  ShoppingCart, UtensilsCrossed, ClipboardList,
  LogOut, ChefHat, LayoutGrid, BarChart2, Users, Timer, Package, Star, Truck, CalendarClock, Settings
} from 'lucide-react'

type Role = 'tenant_admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen'
const ALL: Role[] = ['tenant_admin', 'manager', 'cashier', 'waiter', 'kitchen']
const STAFF: Role[] = ['tenant_admin', 'manager', 'cashier', 'waiter']
const ADMIN: Role[] = ['tenant_admin', 'manager']

// Cada item declara que roles pueden verlo — sin esto, un mesero o cocina
// veian el menu completo (inventario, reportes, empleados) aunque el backend
// les bloqueara la accion al hacer clic. Confuso y mala primera impresion.
const navItems = [
  { href: '/pos',             labelKey: 'nav.pos'          as const, icon: ShoppingCart,      roles: STAFF },
  { href: '/pos/tables',      labelKey: 'nav.tables'       as const, icon: LayoutGrid,         roles: STAFF },
  { href: '/pos/reservations',labelKey: 'nav.reservations' as const, icon: CalendarClock,      roles: STAFF },
  { href: '/pos/orders',      labelKey: 'nav.orders'       as const, icon: ClipboardList,      roles: ALL },
  { href: '/pos/kitchen',     labelKey: 'nav.kitchen'      as const, icon: ChefHat,             roles: ALL },
  { href: '/pos/menu',        labelKey: 'nav.menu'         as const, icon: UtensilsCrossed,    roles: ADMIN },
  { href: '/pos/inventory',   labelKey: 'nav.inventory'    as const, icon: Package,             roles: ADMIN },
  { href: '/pos/loyalty',     labelKey: 'nav.loyalty'      as const, icon: Star,                roles: [...ADMIN, 'cashier'] as Role[] },
  { href: '/pos/integrations',labelKey: 'nav.integrations' as const, icon: Truck,               roles: ADMIN },
  { href: '/pos/reports',     labelKey: 'nav.reports'      as const, icon: BarChart2,           roles: ADMIN },
  { href: '/pos/users',       labelKey: 'nav.users'        as const, icon: Users,               roles: ADMIN },
  { href: '/pos/shift',       labelKey: 'nav.shift'        as const, icon: Timer,                roles: [...ADMIN, 'cashier'] as Role[] },
  { href: '/pos/settings',   labelKey: 'nav.settings'     as const, icon: Settings,             roles: ADMIN },
]

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { t }    = useT()
  const { user, logout } = useAuthStore()
  // Al entrar por una recarga completa (F5, link directo, pestaña nueva) el store
  // arranca en frío: hay que esperar a que zustand termine de leer localStorage
  // antes de decidir si redirigir a /login, o se dispara un falso redirect.
  // Ojo: `useAuthStore.persist` no existe durante el renderizado en el servidor
  // (no hay localStorage ahí) — hay que arrancar en `false` y solo tocarlo
  // dentro de useEffect, que nunca corre en el servidor.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) { setHydrated(true); return }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (hydrated && !user) router.replace('/login')
  }, [hydrated, user, router])

  const allowedNavItems = navItems.filter(item => !user || item.roles.includes(user.role as Role))

  // Si un rol entra directo por URL (link guardado, escrita a mano) a una
  // pagina que no le corresponde, lo manda a la primera que si puede ver en
  // vez de dejarlo en una pantalla que el backend le va a rechazar en cada click.
  useEffect(() => {
    if (!hydrated || !user) return
    const current = navItems.find(item => pathname === item.href || pathname?.startsWith(item.href + '/'))
    if (current && !current.roles.includes(user.role as Role)) {
      router.replace(allowedNavItems[0]?.href ?? '/pos')
    }
  }, [hydrated, user, pathname, router, allowedNavItems])

  // Notificacion de pedido nuevo global — antes solo sonaba en /pos/orders y
  // /pos/kitchen, asi que si el cajero estaba en cualquier otra pantalla
  // (mesas, punto de venta, etc.) nunca se enteraba de que llego un pedido.
  const qc = useQueryClient()
  useSocket({
    'order:new': (data: unknown) => {
      const order = data as { order_number: string; customer_name?: string }
      toast.success(`Nuevo pedido ${order.order_number}${order.customer_name ? ` — ${order.customer_name}` : ''}`, { icon: '🔔', duration: 6000 })
      qc.invalidateQueries({ queryKey: ['all-orders'] })
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
    },
  })

  if (!hydrated || !user) return null

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f5f6fa' }}>
      {/* ── Sidebar (dark) ── */}
      <aside
        className="w-16 md:w-56 flex flex-col flex-shrink-0"
        style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div className="px-3 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-1">
            <DSDLogo size={36} showWordmark />
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {allowedNavItems.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
                style={active ? {
                  background: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                } : {
                  color: '#6b7280',
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: '#f97316' }}
                  />
                )}
                <Icon
                  size={17}
                  className="flex-shrink-0"
                  style={{ color: active ? '#ffffff' : '#4b5563' }}
                />
                <span
                  className="hidden md:block text-sm font-medium"
                  style={{ color: active ? '#ffffff' : '#6b7280' }}
                >
                  {t(labelKey)}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="px-2 py-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {/* User info */}
          <div
            className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}
            >
              {user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs truncate leading-tight" style={{ color: '#d1d5db' }}>{user.email}</p>
              <p className="text-[10px] font-semibold capitalize leading-tight mt-0.5" style={{ color: '#f97316' }}>
                {user.role.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
            style={{ color: '#6b7280' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <LogOut size={17} className="flex-shrink-0" />
            <span className="hidden md:block text-sm font-medium">{t('nav.logout')}</span>
          </button>
          <div className="hidden md:flex justify-center pt-1">
            <LanguageSwitcher variant="dark" />
          </div>
        </div>
      </aside>

      {/* ── Main content (light) ── */}
      <main className="flex-1 overflow-hidden" style={{ background: '#f5f6fa' }}>
        {children}
      </main>
      {user.role === 'tenant_admin' && <BusinessAssistant />}
    </div>
  )
}
