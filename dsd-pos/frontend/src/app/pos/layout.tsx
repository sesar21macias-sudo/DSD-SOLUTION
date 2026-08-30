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
    // '/pos' es prefijo de toda ruta anidada (/pos/reports, /pos/users...) —
    // buscando en orden de declaracion, ese match generico ganaba siempre
    // antes que la entrada especifica, y la redireccion nunca se disparaba
    // para rutas restringidas. Se ordena por longitud de href (mas especifico
    // primero) antes de buscar.
    const current = [...navItems]
      .sort((a, b) => b.href.length - a.href.length)
      .find(item => pathname === item.href || pathname?.startsWith(item.href + '/'))
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

  const SYSTEM_FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif"
  const BLUE = '#007AFF'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f2f2f7', fontFamily: SYSTEM_FONT }}>
      {/* ── Sidebar: vidrio esmerilado claro, estilo panel lateral de macOS ── */}
      <aside
        className="w-16 md:w-60 flex flex-col flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRight: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="px-4 py-5">
          <div className="px-1">
            <DSDLogo size={32} showWordmark />
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {allowedNavItems.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-200"
                style={active ? {
                  background: BLUE,
                  color: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,122,255,0.3)',
                } : {
                  color: '#3c3c43',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={17} className="flex-shrink-0" style={{ color: active ? '#ffffff' : '#8e8e93' }} />
                <span className="hidden md:block text-[13px] font-medium tracking-tight" style={{ color: active ? '#ffffff' : '#1c1c1e' }}>
                  {t(labelKey)}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-3 space-y-1" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {/* User info */}
          <div
            className="hidden md:flex items-center gap-2.5 px-3 py-2.5 rounded-[10px]"
            style={{ background: 'rgba(0,0,0,0.03)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
              style={{ background: BLUE }}
            >
              {user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs truncate leading-tight font-medium" style={{ color: '#1c1c1e' }}>{user.email}</p>
              <p className="text-[10px] font-semibold capitalize leading-tight mt-0.5" style={{ color: BLUE }}>
                {user.role.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-200"
            style={{ color: '#8e8e93' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,59,48,0.08)'
              e.currentTarget.style.color = '#ff3b30'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#8e8e93'
            }}
          >
            <LogOut size={17} className="flex-shrink-0" />
            <span className="hidden md:block text-[13px] font-medium">{t('nav.logout')}</span>
          </button>
          <div className="hidden md:flex justify-center pt-1">
            <LanguageSwitcher variant="dark" />
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden" style={{ background: '#f2f2f7', fontFamily: SYSTEM_FONT }}>
        {children}
      </main>
      {user.role === 'tenant_admin' && <BusinessAssistant />}
    </div>
  )
}
