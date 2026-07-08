'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { BarChart2, TrendingUp, TrendingDown, ShoppingBag, CreditCard, Banknote, Smartphone, UtensilsCrossed, Bike, PackageOpen, Globe, PieChart, AlertTriangle } from 'lucide-react'

interface DailySummary {
  total_orders: number; paid_orders: number; cancelled_orders: number
  total_mxn: number; total_usd: number
  by_type: { dine_in: number; takeout: number; delivery: number; online: number }
  by_payment_method: { cash: number; card: number; transfer: number; online: number }
  date: string
}
interface TopProduct { name: string; qty: number; revenue: number }
interface Trends {
  period: 'week' | 'month'
  current: { orders: number; revenue: number }
  previous: { orders: number; revenue: number }
  revenue_change_pct: number | null
  orders_change_pct: number | null
  avg_ticket_current: number
  avg_ticket_previous: number
}
interface ProductMix { category: string; revenue: number; pct: number }
interface Margin { product_id: string; name: string; qty: number; revenue: number; cost: number | null; margin_pct: number | null; has_cost_data: boolean }

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const positive = pct >= 0
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: positive ? '#f0fdf4' : '#fef2f2', color: positive ? '#15803d' : '#dc2626' }}>
      {positive ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
      {positive ? '+' : ''}{pct}%
    </span>
  )
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f0f2f5', color: '#374151' }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black" style={{ color: '#111827' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{sub}</p>}
    </div>
  )
}

export default function ReportsPage() {
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month'>('week')

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
  const { data: trends } = useQuery<Trends>({
    queryKey: ['trends', trendPeriod],
    queryFn: async () => { const { data } = await api.get('/reports/trends', { params: { period: trendPeriod } }); return data.data },
  })
  const { data: productMix } = useQuery<ProductMix[]>({
    queryKey: ['product-mix'],
    queryFn: async () => { const { data } = await api.get('/reports/product-mix'); return data.data },
  })
  const { data: margins } = useQuery<Margin[]>({
    queryKey: ['margins'],
    queryFn: async () => { const { data } = await api.get('/reports/margins'); return data.data },
  })

  const worstMargins = margins?.filter(m => m.has_cost_data).slice(0, 5) ?? []
  const bestMargins   = margins?.filter(m => m.has_cost_data).slice(-5).reverse() ?? []
  const mixColors = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#f97316', '#0ea5e9']

  const maxRevenue   = Math.max(...(byHour?.map(h => h.revenue) ?? [1]), 1)
  const totalPayment = (summary?.total_mxn ?? 0) + (summary?.total_usd ?? 0)

  const payMethods = [
    { key: 'cash',     label: 'Efectivo',      icon: <Banknote size={14}/>,   bar: '#111827' },
    { key: 'card',     label: 'Tarjeta',        icon: <CreditCard size={14}/>, bar: '#374151' },
    { key: 'transfer', label: 'Transferencia',  icon: <Smartphone size={14}/>, bar: '#6b7280' },
  ]
  const orderTypes = [
    { key: 'dine_in',  label: 'En mesa',    icon: <UtensilsCrossed size={15}/> },
    { key: 'takeout',  label: 'Para llevar', icon: <PackageOpen size={15}/> },
    { key: 'delivery', label: 'Delivery',   icon: <Bike size={15}/> },
    { key: 'online',   label: 'En línea',   icon: <Globe size={15}/> },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <BarChart2 size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Reportes del día</h1>
        <span className="ml-auto text-xs font-medium" style={{ color: '#9ca3af' }}>{summary?.date}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Ventas MXN"       value={`$${(summary?.total_mxn ?? 0).toFixed(2)}`}  icon={<TrendingUp size={15}/>} />
          <StatCard label="Ventas USD"       value={`$${(summary?.total_usd ?? 0).toFixed(2)}`}  icon={<TrendingUp size={15}/>} />
          <StatCard label="Órdenes totales"  value={String(summary?.total_orders ?? 0)}            icon={<ShoppingBag size={15}/>} sub={`${summary?.cancelled_orders ?? 0} canceladas`} />
          <StatCard label="Órdenes cobradas" value={String(summary?.paid_orders ?? 0)}             icon={<CreditCard size={15}/>} />
        </div>

        {/* Tendencias: período actual vs anterior */}
        <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: '#111827' }}>Tendencia</h3>
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f0f2f5' }}>
              {(['week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setTrendPeriod(p)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                  style={trendPeriod === p ? { background: '#111827', color: '#ffffff' } : { color: '#6b7280' }}>
                  {p === 'week' ? 'Últimos 7 días' : 'Últimos 30 días'}
                </button>
              ))}
            </div>
          </div>
          {trends && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Ingresos</p>
                <p className="text-xl font-black" style={{ color: '#111827' }}>${trends.current.revenue.toFixed(2)}</p>
                <div className="mt-1.5"><ChangeBadge pct={trends.revenue_change_pct} /></div>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Órdenes</p>
                <p className="text-xl font-black" style={{ color: '#111827' }}>{trends.current.orders}</p>
                <div className="mt-1.5"><ChangeBadge pct={trends.orders_change_pct} /></div>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Ticket promedio</p>
                <p className="text-xl font-black" style={{ color: '#111827' }}>${trends.avg_ticket_current.toFixed(2)}</p>
                <p className="text-[10px] mt-1.5" style={{ color: '#9ca3af' }}>antes: ${trends.avg_ticket_previous.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payment methods */}
          <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#111827' }}>Por método de pago</h3>
            <div className="space-y-3">
              {payMethods.map(({ key, label, icon, bar }) => {
                const amount = summary?.by_payment_method[key as keyof typeof summary.by_payment_method] ?? 0
                const pct    = totalPayment > 0 ? (amount / totalPayment) * 100 : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-2" style={{ color: '#4b5563' }}>{icon}{label}</span>
                      <span className="font-semibold" style={{ color: '#111827' }}>${amount.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: '#f0f2f5' }}>
                      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: bar }} />
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>{pct.toFixed(0)}%</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order types */}
          <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#111827' }}>Por tipo de orden</h3>
            <div className="grid grid-cols-2 gap-2">
              {orderTypes.map(({ key, label, icon }) => (
                <div key={key} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                  <span style={{ color: '#6b7280' }}>{icon}</span>
                  <p className="text-2xl font-black" style={{ color: '#111827' }}>
                    {summary?.by_type[key as keyof typeof summary.by_type] ?? 0}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hourly chart */}
        <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
          <h3 className="text-sm font-bold mb-5" style={{ color: '#111827' }}>Ventas por hora</h3>
          <div className="flex items-end gap-1" style={{ height: '80px' }}>
            {byHour?.filter(h => h.hour >= 6 && h.hour <= 23).map(h => {
              const heightPct = maxRevenue > 0 ? (h.revenue / maxRevenue) * 100 : 0
              const isActive  = h.revenue > 0
              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {isActive && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded whitespace-nowrap pointer-events-none z-10 text-[10px] px-1.5 py-0.5 font-semibold"
                      style={{ background: '#111827', color: '#ffffff' }}>
                      ${h.revenue.toFixed(0)}
                    </div>
                  )}
                  <div className="w-full rounded-t transition-all duration-500"
                    style={{ height: `${Math.max(heightPct * 0.6, isActive ? 4 : 0)}px`, background: isActive ? '#111827' : '#f0f2f5' }} />
                  <span className="text-[9px]" style={{ color: '#9ca3af' }}>{h.hour}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top products */}
        <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: '#111827' }}>Productos más vendidos</h3>
          <div className="space-y-1">
            {topProducts?.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < (topProducts.length - 1) ? '1px solid #f0f2f5' : 'none' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: i === 0 ? '#111827' : '#f0f2f5', color: i === 0 ? '#ffffff' : '#6b7280' }}>
                  {i + 1}
                </span>
                <p className="flex-1 text-sm" style={{ color: '#374151' }}>{p.name}</p>
                <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>{p.qty}×</span>
                <span className="text-sm font-bold" style={{ color: '#111827' }}>${p.revenue.toFixed(2)}</span>
              </div>
            ))}
            {(!topProducts || topProducts.length === 0) && (
              <p className="text-sm text-center py-6" style={{ color: '#d1d5db' }}>Sin ventas registradas hoy</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mezcla de productos */}
          <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: '#111827' }}>
              <PieChart size={14} style={{ color: '#6b7280' }}/> Mezcla de productos
            </h3>
            <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>% de ingresos por categoría, últimos 30 días</p>
            <div className="space-y-2.5">
              {productMix?.map((m, i) => (
                <div key={m.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span style={{ color: '#4b5563' }}>{m.category}</span>
                    <span className="font-semibold" style={{ color: '#111827' }}>{m.pct}% · ${m.revenue.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#f0f2f5' }}>
                    <div className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${m.pct}%`, background: mixColors[i % mixColors.length] }} />
                  </div>
                </div>
              ))}
              {(!productMix || productMix.length === 0) && (
                <p className="text-sm text-center py-6" style={{ color: '#d1d5db' }}>Sin ventas en los últimos 30 días</p>
              )}
            </div>
          </div>

          {/* Márgenes */}
          <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: '#111827' }}>
              <AlertTriangle size={14} style={{ color: '#6b7280' }}/> Márgenes de ganancia
            </h3>
            <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>Últimos 30 días, requiere costo cargado en el producto</p>
            {worstMargins.length === 0 && bestMargins.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#d1d5db' }}>
                Ningún producto tiene costo cargado todavía — agrégalo en Menú para ver márgenes
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#dc2626' }}>Menor margen</p>
                  <div className="space-y-1">
                    {worstMargins.map(m => (
                      <div key={m.product_id} className="flex items-center justify-between text-sm py-1">
                        <span style={{ color: '#4b5563' }}>{m.name}</span>
                        <span className="font-bold" style={{ color: (m.margin_pct ?? 0) < 20 ? '#dc2626' : '#111827' }}>
                          {m.margin_pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#15803d' }}>Mayor margen</p>
                  <div className="space-y-1">
                    {bestMargins.map(m => (
                      <div key={m.product_id} className="flex items-center justify-between text-sm py-1">
                        <span style={{ color: '#4b5563' }}>{m.name}</span>
                        <span className="font-bold" style={{ color: '#15803d' }}>{m.margin_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
