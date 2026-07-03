'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import toast from 'react-hot-toast'
import { Clock, ChefHat, CheckCircle, Flame, PackageCheck } from 'lucide-react'

interface Order {
  id: string; order_number: string; type: string; status: string
  customer_name?: string; notes?: string; created_at: string
  tables?: { number: number; name: string }
  order_items: { id: string; quantity: number; notes?: string; menu_products: { name: string } }[]
}

const STATUS_CFG: Record<string, { label: string; bg: string; border: string; badge: string; badgeFg: string }> = {
  pending:   { label: 'Nueva orden',       bg: '#fffbeb', border: '#fde68a', badge: '#fef3c7', badgeFg: '#92400e' },
  confirmed: { label: 'Confirmada',        bg: '#eff6ff', border: '#bfdbfe', badge: '#dbeafe', badgeFg: '#1e40af' },
  preparing: { label: 'En cocina 🔥',     bg: '#fff7ed', border: '#fed7aa', badge: '#ffedd5', badgeFg: '#9a3412' },
  ready:     { label: 'Lista ✓',          bg: '#f0fdf4', border: '#bbf7d0', badge: '#dcfce7', badgeFg: '#14532d' },
}

const BTN_CFG: Record<string, { label: string; next: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: 'Iniciar preparación',  next: 'preparing', bg: '#ea580c', icon: <Flame size={14}/> },
  confirmed: { label: 'Iniciar preparación',  next: 'preparing', bg: '#ea580c', icon: <Flame size={14}/> },
  preparing: { label: 'Marcar como lista',    next: 'ready',     bg: '#16a34a', icon: <CheckCircle size={14}/> },
  ready:     { label: 'Entregada al cliente', next: 'delivered', bg: '#2563eb', icon: <PackageCheck size={14}/> },
}

function elapsed(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  return m < 1 ? 'Ahora' : `${m} min`
}
function elapsedColor(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  return m < 5 ? '#16a34a' : m < 10 ? '#d97706' : '#dc2626'
}

export default function KitchenPage() {
  const qc = useQueryClient()

  useSocket({
    'order:new':     (data: unknown) => { qc.invalidateQueries({ queryKey: ['kitchen-orders'] }); toast(`Nueva: ${(data as { order_number: string }).order_number}`, { icon: '🔔' }) },
    'order:updated': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
    'order:paid':    () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  })

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['kitchen-orders'],
    queryFn: async () => { const { data } = await api.get('/orders'); return data.data },
    refetchInterval: 15000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
      const labels: Record<string, string> = { preparing: 'En preparación', ready: '¡Lista!', delivered: 'Entregada' }
      toast.success(labels[v.status] ?? 'Actualizado')
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const active    = orders?.filter(o => ['pending','confirmed','preparing'].includes(o.status)) ?? []
  const ready     = orders?.filter(o => o.status === 'ready') ?? []
  const displayed = [...active, ...ready]

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <ChefHat size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Pantalla de Cocina</h1>
        <div className="ml-auto flex items-center gap-3 text-xs font-semibold">
          {active.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
              <Flame size={12}/> {active.length} en curso
            </span>
          )}
          {ready.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
              <PackageCheck size={12}/> {ready.length} lista(s)
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm" style={{ color: '#9ca3af' }}>Cargando órdenes...</div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0f2f5' }}>
              <ChefHat size={36} style={{ color: '#d1d5db' }} />
            </div>
            <p className="font-semibold" style={{ color: '#374151' }}>Sin órdenes activas</p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>Las nuevas órdenes aparecerán aquí</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayed.map(order => {
              const cfg    = STATUS_CFG[order.status] ?? STATUS_CFG['pending']
              const btnCfg = BTN_CFG[order.status]
              const mins   = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)

              return (
                <div key={order.id} className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>

                  {/* Order header */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cfg.border}` }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: elapsedColor(order.created_at) }} />
                      <p className="font-black text-sm" style={{ color: '#111827' }}>{order.order_number}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.badge, color: cfg.badgeFg }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold" style={{ color: elapsedColor(order.created_at) }}>
                      <Clock size={12}/> {elapsed(order.created_at)}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#111827' }}>
                          {order.tables ? `Mesa ${order.tables.number} — ${order.tables.name}` :
                           order.type === 'takeout' ? 'Para llevar' : 'Delivery'}
                        </p>
                        {order.customer_name && <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{order.customer_name}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>Tiempo</p>
                        <p className="text-sm font-black" style={{ color: elapsedColor(order.created_at) }}>{mins}m</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(0,0,0,0.04)' }}>
                      {order.order_items.map(item => (
                        <div key={item.id} className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                            style={{ background: '#111827' }}>
                            {item.quantity}
                          </span>
                          <div>
                            <p className="text-sm font-semibold leading-tight" style={{ color: '#111827' }}>{item.menu_products.name}</p>
                            {item.notes && <p className="text-xs mt-0.5" style={{ color: '#d97706' }}>⚠ {item.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order notes */}
                    {order.notes && (
                      <div className="rounded-xl px-3 py-2" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
                        <p className="text-xs" style={{ color: '#713f12' }}>📝 {order.notes}</p>
                      </div>
                    )}

                    {/* Action button */}
                    {btnCfg && (
                      <div className="mt-auto">
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: btnCfg.next })}
                          disabled={updateStatus.isPending}
                          className="w-full text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                          style={{ background: btnCfg.bg }}>
                          {btnCfg.icon} {btnCfg.label}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
