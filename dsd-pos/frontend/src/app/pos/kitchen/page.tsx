'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import toast from 'react-hot-toast'
import { Clock, ChefHat, CheckCircle, Flame, PackageCheck } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  type: string
  status: string
  customer_name?: string
  notes?: string
  created_at: string
  tables?: { number: number; name: string }
  order_items: {
    id: string
    quantity: number
    notes?: string
    menu_products: { name: string }
  }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Nueva orden',  color: 'border-yellow-500 bg-yellow-500/5',  dot: 'bg-yellow-400' },
  confirmed: { label: 'Confirmada',   color: 'border-blue-500 bg-blue-500/5',      dot: 'bg-blue-400' },
  preparing: { label: 'En cocina',    color: 'border-orange-500 bg-orange-500/5',  dot: 'bg-orange-400' },
  ready:     { label: 'Lista ✓',      color: 'border-green-500 bg-green-500/5',    dot: 'bg-green-400' },
}

function elapsed(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'Ahora'
  if (mins === 1) return '1 min'
  return `${mins} min`
}

function elapsedColor(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 5) return 'text-green-400'
  if (mins < 10) return 'text-yellow-400'
  return 'text-red-400'
}

export default function KitchenPage() {
  const qc = useQueryClient()

  useSocket({
    'order:new': (data: unknown) => {
      const order = data as { order_number: string }
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
      toast(`Nueva orden: ${order.order_number}`, { icon: '🔔', duration: 5000 })
    },
    'order:updated': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
    'order:paid': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  })

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['kitchen-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders')
      return data.data
    },
    refetchInterval: 15000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
      const labels: Record<string, string> = {
        preparing: 'Orden en preparación',
        ready: '¡Orden lista para entregar!',
        delivered: 'Orden entregada',
      }
      toast.success(labels[vars.status] ?? 'Estado actualizado')
    },
    onError: () => toast.error('Error al actualizar estado'),
  })

  const active = orders?.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status)) ?? []
  const ready  = orders?.filter(o => o.status === 'ready') ?? []

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <ChefHat className="text-orange-400" size={20} />
        <h1 className="text-lg font-bold text-white">Pantalla de Cocina</h1>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {active.length > 0 && (
            <span className="flex items-center gap-1.5 text-orange-400">
              <Flame size={14} /> {active.length} en curso
            </span>
          )}
          {ready.length > 0 && (
            <span className="flex items-center gap-1.5 text-green-400">
              <PackageCheck size={14} /> {ready.length} lista(s)
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">Cargando...</div>
        ) : active.length === 0 && ready.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <ChefHat size={48} className="mb-3 opacity-30" />
            <p className="text-lg">Sin órdenes activas</p>
            <p className="text-sm mt-1">Las nuevas órdenes aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...active, ...ready].map((order) => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['pending']
              return (
                <div key={order.id} className={`border rounded-2xl p-4 flex flex-col gap-3 ${cfg.color}`}>
                  {/* Order header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                        <p className="font-black text-white text-base">{order.order_number}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.tables ? `Mesa ${order.tables.number}` : order.type === 'takeout' ? 'Para llevar' : 'Delivery'}
                        {order.customer_name && ` · ${order.customer_name}`}
                      </p>
                      <span className="text-xs font-medium text-gray-300 bg-gray-800 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {cfg.label}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-bold ${elapsedColor(order.created_at)}`}>
                      <Clock size={12} />
                      {elapsed(order.created_at)}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="bg-black/20 rounded-xl p-3 space-y-2">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span className="bg-orange-500 text-white text-xs font-black w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                          {item.quantity}
                        </span>
                        <div>
                          <p className="text-sm text-white font-semibold leading-tight">{item.menu_products.name}</p>
                          {item.notes && (
                            <p className="text-xs text-yellow-300 mt-0.5">⚠ {item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  {order.notes && (
                    <p className="text-xs text-yellow-300 bg-yellow-900/20 rounded-lg p-2">
                      📝 {order.notes}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 mt-auto">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'preparing' })}
                        disabled={updateStatus.isPending}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <Flame size={15} /> Iniciar preparación
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'ready' })}
                        disabled={updateStatus.isPending}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={15} /> Marcar como lista
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'delivered' })}
                        disabled={updateStatus.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <PackageCheck size={15} /> Entregada al cliente
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'preparing' })}
                        disabled={updateStatus.isPending}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <Flame size={15} /> Iniciar preparación
                      </button>
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
