'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { ClipboardList, RefreshCw, LayoutGrid, ShoppingBag } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  type: string
  status: string
  customer_name?: string
  total: number
  currency: string
  created_at: string
  tables?: { number: number }
  order_items: { quantity: number; menu_products: { name: string } }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  preparing: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ready:     'bg-green-500/20 text-green-400 border-green-500/30',
  delivered: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  paid:      'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', preparing: 'Preparando',
  ready: 'Lista', delivered: 'Entregada', paid: 'Pagada', cancelled: 'Cancelada',
}

type FilterType = 'all' | 'dine_in' | 'takeout' | 'delivery' | 'online'
type FilterStatus = 'all' | 'active' | 'paid' | 'cancelled'

export default function OrdersPage() {
  const qc = useQueryClient()
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active')

  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ['all-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders')
      return data.data
    },
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
    const typeOk = filterType === 'all' || o.type === filterType
    const statusOk =
      filterStatus === 'all' ? true :
      filterStatus === 'active' ? !['paid', 'cancelled'].includes(o.status) :
      filterStatus === 'paid' ? o.status === 'paid' :
      o.status === 'cancelled'
    return typeOk && statusOk
  })

  const typeFilters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all',      label: 'Todas',        icon: <ClipboardList size={13} /> },
    { key: 'dine_in',  label: 'Mesa',         icon: <LayoutGrid size={13} /> },
    { key: 'takeout',  label: 'Para llevar',  icon: <ShoppingBag size={13} /> },
    { key: 'delivery', label: 'Delivery',     icon: <ShoppingBag size={13} /> },
  ]

  const statusFilters: { key: FilterStatus; label: string }[] = [
    { key: 'active',    label: 'Activas' },
    { key: 'all',       label: 'Todas' },
    { key: 'paid',      label: 'Pagadas' },
    { key: 'cancelled', label: 'Canceladas' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <ClipboardList className="text-orange-400" size={20} />
        <h1 className="text-lg font-bold text-white">Órdenes</h1>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{filtered?.length ?? 0}</span>
        <button onClick={() => refetch()} className="ml-auto text-gray-400 hover:text-white transition">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filtros tipo */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex gap-2 overflow-x-auto">
        {typeFilters.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setFilterType(key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${filterType === key ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {icon}{label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {statusFilters.map(({ key, label }) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${filterStatus === key ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">Cargando...</div>
        ) : filtered?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600">
            <ClipboardList size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Sin órdenes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered?.map((order) => (
              <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  {/* Tipo badge */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${order.type === 'dine_in' ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
                    {order.type === 'dine_in'
                      ? <LayoutGrid size={18} className="text-orange-400" />
                      : <ShoppingBag size={18} className="text-blue-400" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{order.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                        {order.type === 'dine_in' ? `Mesa ${order.tables?.number ?? '—'}` :
                         order.type === 'takeout' ? 'Para llevar' :
                         order.type === 'delivery' ? 'Delivery' : 'En línea'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {order.order_items.map(i => `${i.quantity}x ${i.menu_products.name}`).join(' · ')}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-orange-400 font-bold text-sm">
                      {order.currency === 'USD' ? 'USD ' : '$'}{Number(order.total).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Acciones */}
                {!['paid', 'cancelled'].includes(order.status) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
                    {order.status === 'delivered' && (
                      <button onClick={() => markPaid.mutate(order.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 rounded-lg transition">
                        Cobrar
                      </button>
                    )}
                    <button onClick={() => cancelOrder.mutate(order.id)}
                      className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-semibold py-2 rounded-lg transition">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
