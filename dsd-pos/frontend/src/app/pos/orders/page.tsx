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
  order_items: { quantity: number; notes?: string | null; menu_products: { name: string } | null }[]
  payments?: { method: string; status: string }[]
}

// Paleta de estados alineada a los colores de sistema de iOS/macOS
// (naranja, azul, verde, morado, rojo) en vez de los tonos genericos previos.
const STATUS_CFG: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  pending_payment: { label: 'Por cobrar en caja', fg: '#c2410c', bg: '#fff4ea', border: 'transparent' },
  pending:   { label: 'Pendiente',   fg: '#a1580a', bg: '#fff8ea', border: 'transparent' },
  confirmed: { label: 'Confirmada',  fg: '#007AFF', bg: '#eaf3ff', border: 'transparent' },
  preparing: { label: 'Preparando', fg: '#FF9500', bg: '#fff4e5', border: 'transparent' },
  ready:     { label: 'Lista',       fg: '#34C759', bg: '#e9f9ec', border: 'transparent' },
  delivered: { label: 'Entregada',  fg: '#AF52DE', bg: '#f6ecfb', border: 'transparent' },
  paid:      { label: 'Pagada',     fg: '#8e8e93', bg: '#f2f2f7', border: 'transparent' },
  cancelled: { label: 'Cancelada',  fg: '#FF3B30', bg: '#ffeceb', border: 'transparent' },
}

const PAYMENT_LABEL: Record<string, string> = { card: '💳 Tarjeta', cash: '💵 Efectivo', transfer: '🏦 Transferencia', online: '💳 En linea' }

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

  // La notificacion de pedido nuevo ahora vive en el layout (pos/layout.tsx)
  // para que suene sin importar en que pantalla del POS este el cajero.

  // Antes esto solo hacia PATCH status:'paid' directo, sin pasar por
  // /payments — no quedaba registro del metodo de pago y el cliente no
  // acumulaba puntos de lealtad para ninguna orden cerrada por aqui.
  const markPaid = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: 'cash' | 'card' | 'transfer' }) => {
      await api.post('/payments', { order_id: id, method })
      await api.patch(`/orders/${id}/status`, { status: 'paid' })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-orders'] }); toast.success('Orden marcada como pagada'); setChargingOrder(null) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'No se pudo cobrar'),
  })
  const cancelOrder = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/cancel`, { reason: 'Cancelada desde panel' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-orders'] }); toast.success('Orden cancelada') },
  })
  const [chargingOrder, setChargingOrder] = useState<Order | null>(null)
  const chargeAtCounter = useMutation({
    mutationFn: ({ id, method }: { id: string; method: 'cash' | 'card' | 'transfer' }) => api.post(`/orders/${id}/charge-counter`, { method }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-orders'] })
      toast.success('Cobrado — enviado a cocina')
      setChargingOrder(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'No se pudo cobrar'),
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
    <div className="h-full flex flex-col" style={{ background: '#f2f2f7' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: '#1c1c1e' }}>Órdenes</h1>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}>
          {filtered?.length ?? 0}
        </span>
        <button onClick={() => refetch()} className="ml-auto p-2 rounded-full transition"
          style={{ color: '#8e8e93', background: 'rgba(0,0,0,0.04)' }}>
          <RefreshCw size={14}/>
        </button>
      </div>

      {/* Filtros tipo */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        {typeFilters.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setFilterType(key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all"
            style={filterType === key
              ? { background: '#007AFF', color: '#ffffff' }
              : { background: 'rgba(0,0,0,0.05)', color: '#3c3c43' }}>
            {icon}{label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {statusFilters.map(({ key, label }) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all"
              style={filterStatus === key
                ? { background: 'rgba(0,0,0,0.08)', color: '#1c1c1e' }
                : { background: 'transparent', color: '#8e8e93' }}>
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
          <div className="space-y-2.5">
            {filtered?.map(order => {
              const cfg = STATUS_CFG[order.status] ?? STATUS_CFG['pending']
              return (
                <div key={order.id} className="rounded-2xl p-4 transition-shadow" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)' }}>
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
                        {order.customer_name && (
                          <span className="text-xs font-medium" style={{ color: '#374151' }}>{order.customer_name}</span>
                        )}
                        {(() => {
                          const paid = order.payments?.find(p => p.status === 'completed')
                          return paid ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                              {PAYMENT_LABEL[paid.method] ?? paid.method}
                            </span>
                          ) : null
                        })()}
                      </div>
                      <p className="text-xs mt-1 truncate" style={{ color: '#9ca3af' }}>
                        {order.order_items.map(i => `${i.quantity}× ${i.menu_products?.name ?? i.notes ?? 'Producto'}`).join(' · ')}
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
                  {order.status === 'pending_payment' && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fff7ed', border: '1px solid #fdba74' }}>
                      <span className="text-xs font-medium flex-1" style={{ color: '#9a3412' }}>
                        Cliente muestra su ticket con QR — cobra y se manda a cocina
                      </span>
                      <button onClick={() => setChargingOrder(order)}
                        className="text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                        style={{ background: '#16a34a' }}>
                        Cobrar y enviar a cocina
                      </button>
                    </div>
                  )}
                  {!['paid','cancelled','pending_payment'].includes(order.status) && (
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #f0f2f5' }}>
                      {order.status === 'delivered' && (
                        <button onClick={() => setChargingOrder(order)}
                          className="flex-1 text-white text-xs font-semibold py-2 rounded-lg transition"
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

      {/* Selector de metodo de pago antes de cobrar en caja */}
      {chargingOrder && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={() => setChargingOrder(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xs rounded-2xl p-5 space-y-4"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div>
              <p className="font-bold text-sm" style={{ color: '#111827' }}>Cobrar {chargingOrder.order_number}</p>
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                Total: {chargingOrder.currency === 'USD' ? 'USD ' : '$'}{Number(chargingOrder.total).toFixed(2)}
              </p>
            </div>
            <p className="text-xs font-semibold" style={{ color: '#6b7280' }}>¿Con que pago el cliente?</p>
            <div className="grid grid-cols-3 gap-2">
              {([['cash', '💵 Efectivo'], ['card', '💳 Tarjeta'], ['transfer', '🏦 Transferencia']] as const).map(([method, label]) => (
                <button key={method}
                  onClick={() => chargingOrder.status === 'pending_payment'
                    ? chargeAtCounter.mutate({ id: chargingOrder.id, method })
                    : markPaid.mutate({ id: chargingOrder.id, method })}
                  disabled={chargeAtCounter.isPending || markPaid.isPending}
                  className="py-3 rounded-lg text-xs font-bold transition disabled:opacity-40"
                  style={{ background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb' }}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setChargingOrder(null)} className="w-full text-xs font-semibold py-2 rounded-lg" style={{ color: '#9ca3af' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
