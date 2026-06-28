'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import {
  ShoppingCart, UtensilsCrossed, ClipboardList,
  LogOut, ChefHat, LayoutGrid, BarChart2, Users, Timer, Package
} from 'lucide-react'

const navItems = [
  { href: '/pos', label: 'POS / Caja', icon: ShoppingCart },
  { href: '/pos/tables', label: 'Mesas', icon: LayoutGrid },
  { href: '/pos/orders', label: 'Órdenes', icon: ClipboardList },
  { href: '/pos/kitchen', label: 'Cocina', icon: ChefHat },
  { href: '/pos/menu', label: 'Menú', icon: UtensilsCrossed },
  { href: '/pos/inventory', label: 'Inventario', icon: Package },
  { href: '/pos/reports', label: 'Reportes', icon: BarChart2 },
  { href: '/pos/users', label: 'Usuarios', icon: Users },
  { href: '/pos/shift', label: 'Turno / Caja', icon: Timer },
]

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  useEffect(() => {
    if (!user) router.replace('/login')
  }, [user, router])

  if (!user) return null

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-white">DSD</span>
            </div>
            <span className="hidden md:block font-bold text-white text-sm">DSD POS</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="hidden md:block text-sm font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-gray-800 space-y-1">
          <div className="hidden md:block px-3 py-2">
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            <p className="text-xs text-orange-400 font-medium capitalize">{user.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className="hidden md:block text-sm font-medium">Salir</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
