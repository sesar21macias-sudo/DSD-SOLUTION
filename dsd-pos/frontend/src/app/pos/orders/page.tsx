'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { ClipboardList, RefreshCw, LayoutGrid, ShoppingBag, Bike, Globe } from 'lucide-react'

interface Order {
  id: string; order_number: string; type: string; status: string
  customer_name?: string; total: number; currency: string; created_at: string
  tables?: { number: number }
  order_items: { quantity: number; menu_products: { name: string } }[]
}

const STATUS_CFG: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  pending:   { label: 'Pendiente',   fg: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  confirmed: { label: 'Confirmada',  fg: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  preparing: { label: 'Preparando', fg: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
  ready:     { label: 'Lista',       fg: '#14532d', bg: '#f0fdf4', border: '#bbf7d0' },
  delivered: { label: 'Entregada',  fg: '#4c1d95', bg: '#f5f3ff', border: '#ddd6fe' },
  paid:      { label: 'Pagada',     fg: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
  cancelled: { label: 'Cancelada',  fg: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
}

type FilterType   = 'all' | 'dine_in' | 'takeout' | 'delivery' | 'online'
type FilterStatus = 'all' | 'active' | 'paid' | 'cancelled'

export default function OrdersPage() {
  const qc = useQueryClient()
  const [filterType,   setFilterType]   = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active')

  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ['all-orders'],
    queryFn: async () => { const { data } = await api.get('/orders'); return data.data },
    refetchInterval: 5000,
  })

  const markPaid = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/status`, { status: 'paid' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-orders'] }); toast.success('Orden marcada como pagada') },
  })
  const cancelOrder = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/cancel`, { reason: 'Cancelada desde panel' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-orders'] }); toast.success('Orden cancelada') },
  })

  const filtered = orders?.filter(o => {
    const typeOk   = filterType === 'all' || o.type === filterType
    const statusOk = filterStatus === 'all' ? true :
      filterStatus === 'active' ? !['paid','cancelled'].includes(o.status) :
      filterStatus === 'paid'   ? o.status === 'paid' : o.status === 'cancelled'
    return typeOk && statusOk
  })

  const typeFilters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all',      label: 'Todas',       icon: <ClipboardList size={12}/> },
    { key: 'dine_in',  label: 'Mesa',        icon: <LayoutGrid size={12}/> },
    { key: 'takeout',  label: 'Para llevar', icon: <ShoppingBag size={12}/> },
    { key: 'delivery', label: 'Delivery',    icon: <Bike size={12}/> },
    { key: 'online',   label: 'En línea',    icon: <Globe size={12}/> },
  ]
  const statusFilters: { key: FilterStatus; label: string }[] = [
    { key: 'active',    label: 'Activas' },
    { key: 'all',       label: 'Todas' },
    { key: 'paid',      label: 'Pagadas' },
    { key: 'cancelled', label: 'Canceladas' },
  ]

  const typeLabel: Record<string, string> = { dine_in: 'Mesa', takeout: 'Para llevar', delivery: 'Delivery', online: 'En línea' }

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <ClipboardList size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Órdenes</h1>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f0f2f5', color: '#6b7280' }}>
          {filtered?.length ?? 0}
        </span>
        <button onClick={() => refetch()} className="ml-auto p-1.5 rounded-lg transition"
          style={{ color: '#9ca3af' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
          <RefreshCw size={15}/>
        </button>
      </div>

      {/* Filtros tipo */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        {typeFilters.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setFilterType(key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition"
            style={filterType === key
              ? { background: '#111827', color: '#ffffff' }
              : { background: '#f0f2f5', color: '#6b7280' }}>
            {icon}{label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {statusFilters.map(({ key, label }) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={filterStatus === key
                ? { background: '#e5e7eb', color: '#111827' }
                : { background: 'transparent', color: '#9ca3af' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm" style={{ color: '#9ca3af' }}>Cargando...</div>
        ) : filtered?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32" style={{ color: '#d1d5db' }}>
            <ClipboardList size={32} className="mb-2 opacity-30"/>
            <p className="text-sm">Sin órdenes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered?.map(order => {
              const cfg = STATUS_CFG[order.status] ?? STATUS_CFG['pending']
              return (
                <div key={order.id} className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: order.type === 'dine_in' ? '#fff7ed' : '#eff6ff' }}>
                      {order.type === 'dine_in'
                        ? <LayoutGrid size={18} style={{ color: '#ea580c' }}/>
                        : <ShoppingBag size={18} style={{ color: '#2563eb' }}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: '#111827' }}>{order.order_number}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}` }}>
                          {cfg.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f0f2f5', color: '#6b7280' }}>
                          {order.type === 'dine_in' ? `Mesa ${order.tables?.number ?? '—'}` : typeLabel[order.type] ?? order.type}
                        </span>
                      </div>
                      <p className="text-xs mt-1 truncate" style={{ color: '#9ca3af' }}>
                        {order.order_items.map(i => `${i.quantity}× ${i.menu_products.name}`).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm" style={{ color: '#111827' }}>
                        {order.currency === 'USD' ? 'USD ' : '$'}{Number(order.total).toFixed(2)}
                      </p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>
                        {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {!['paid','cancelled'].includes(order.status) && (
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #f0f2f5' }}>
                      {order.status === 'delivered' && (
                        <button onClick={() => markPaid.mutate(order.id)} disabled={markPaid.isPending}
                          className="flex-1 text-white text-xs font-semibold py-2 rounded-lg transition disabled:opacity-40"
                          style={{ background: '#16a34a' }}>
                          Cobrar
                        </button>
                      )}
                      <button onClick={() => cancelOrder.mutate(order.id)} disabled={cancelOrder.isPending}
                        className="flex-1 text-xs font-semibold py-2 rounded-lg transition disabled:opacity-40"
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
