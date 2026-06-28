'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { BarChart2, TrendingUp, ShoppingBag, CreditCard, Banknote, Smartphone } from 'lucide-react'

interface DailySummary {
  total_orders: number
  paid_orders: number
  cancelled_orders: number
  total_mxn: number
  total_usd: number
  by_type: { dine_in: number; takeout: number; delivery: number; online: number }
  by_payment_method: { cash: number; card: number; transfer: number; online: number }
  date: string
}

interface TopProduct { name: string; qty: number; revenue: number }

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-400">{label}</p>
        <div className="text-orange-400">{icon}</div>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ReportsPage() {
  const { data: summary } = useQuery<DailySummary>({
    queryKey: ['daily-summary'],
    queryFn: async () => { const { data } = await api.get('/reports/daily'); return data.data },
    refetchInterval: 30000,
  })

  const { data: topProducts } = useQuery<TopProduct[]>({
    queryKey: ['top-products'],
    queryFn: async () => { const { data } = await api.get('/reports/top-products'); return data.data },
  })

  const { data: byHour } = useQuery<{ hour: number; label: string; orders: number; revenue: number }[]>({
    queryKey: ['sales-by-hour'],
    queryFn: async () => { const { data } = await api.get('/reports/by-hour'); return data.data },
  })

  const maxRevenue = Math.max(...(byHour?.map(h => h.revenue) ?? [1]))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <BarChart2 className="text-orange-400" size={20} />
        <h1 className="text-lg font-bold text-white">Reportes del día</h1>
        <span className="ml-auto text-xs text-gray-500">{summary?.date}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Ventas MXN" value={`$${(summary?.total_mxn ?? 0).toFixed(2)}`} icon={<TrendingUp size={16} />} />
          <StatCard label="Ventas USD" value={`$${(summary?.total_usd ?? 0).toFixed(2)}`} icon={<TrendingUp size={16} />} />
          <StatCard label="Órdenes totales" value={String(summary?.total_orders ?? 0)} sub={`${summary?.cancelled_orders ?? 0} canceladas`} icon={<ShoppingBag size={16} />} />
          <StatCard label="Órdenes cobradas" value={String(summary?.paid_orders ?? 0)} icon={<CreditCard size={16} />} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Método de pago */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Por método de pago</h3>
            <div className="space-y-2">
              {[
                { key: 'cash', label: 'Efectivo', icon: <Banknote size={14} /> },
                { key: 'card', label: 'Tarjeta', icon: <CreditCard size={14} /> },
                { key: 'transfer', label: 'Transferencia', icon: <Smartphone size={14} /> },
              ].map(({ key, label, icon }) => {
                const amount = summary?.by_payment_method[key as keyof typeof summary.by_payment_method] ?? 0
                const total = (summary?.total_mxn ?? 0) + (summary?.total_usd ?? 0)
                const pct = total > 0 ? (amount / total) * 100 : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-gray-400">{icon}{label}</span>
                      <span className="text-white font-semibold">${amount.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full">
                      <div className="h-1.5 bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por tipo de orden */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Por tipo de orden</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'dine_in', label: 'En mesa' },
                { key: 'takeout', label: 'Para llevar' },
                { key: 'delivery', label: 'Delivery' },
                { key: 'online', label: 'En línea' },
              ].map(({ key, label }) => (
                <div key={key} className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-white">
                    {summary?.by_type[key as keyof typeof summary.by_type] ?? 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ventas por hora */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Ventas por hora</h3>
          <div className="flex items-end gap-1 h-24">
            {byHour?.filter(h => h.hour >= 6 && h.hour <= 23).map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-orange-500/80 rounded-t-sm transition-all"
                  style={{ height: `${maxRevenue > 0 ? (h.revenue / maxRevenue) * 80 : 0}px`, minHeight: h.revenue > 0 ? '4px' : '0' }} />
                <span className="text-xs text-gray-600 rotate-0">{h.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top productos */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Productos más vendidos</h3>
          <div className="space-y-2">
            {topProducts?.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="flex-1 text-sm text-white">{p.name}</p>
                <span className="text-xs text-gray-400">{p.qty} vendidos</span>
                <span className="text-sm font-bold text-orange-400">${p.revenue.toFixed(2)}</span>
              </div>
            ))}
            {(!topProducts || topProducts.length === 0) && (
              <p className="text-gray-600 text-sm text-center py-4">Sin ventas hoy</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
