'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import { useRouter } from 'next/navigation'
import { useOrderStore } from '@/store/order'
import toast from 'react-hot-toast'
import { Users, Plus, LayoutGrid, X, Clock, ShoppingBag, ChevronRight, Flame, CheckCircle, PackageCheck, Receipt, Search, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface Table { id: string; number: number; name: string; capacity: number; status: string }

interface OrderItem {
  id: string
  quantity: number
  subtotal: number
  menu_products: { name: string }
}

interface Order {
  id: string
  table_id: string
  order_number: string
  status: string
  subtotal: number
  tax: number
  total: number
  currency: string
  created_at: string
  order_items: OrderItem[]
}

// Color de la tarjeta según estado de la orden
const ORDER_STATUS_STYLE: Record<string, {
  bg: string; border: string; dot: string; dotPulse: boolean; label: string; labelColor: string
}> = {
  pending:   { bg: 'bg-red-500/10',    border: 'border-red-500',    dot: 'bg-red-400',    dotPulse: true,  label: '⚡ Nueva orden',      labelColor: 'text-red-400' },
  confirmed: { bg: 'bg-red-500/10',    border: 'border-red-500',    dot: 'bg-red-400',    dotPulse: true,  label: '⚡ Confirmada',        labelColor: 'text-red-400' },
  preparing: { bg: 'bg-orange-500/10', border: 'border-orange-500', dot: 'bg-orange-400', dotPulse: true,  label: '🔥 En preparación',   labelColor: 'text-orange-400' },
  ready:     { bg: 'bg-yellow-500/10', border: 'border-yellow-400', dot: 'bg-yellow-400', dotPulse: true,  label: '✅ Lista — entregar', labelColor: 'text-yellow-400' },
  delivered: { bg: 'bg-blue-500/10',   border: 'border-blue-500',   dot: 'bg-blue-400',   dotPulse: false, label: '📦 Entregada',         labelColor: 'text-blue-400' },
}

const AVAILABLE_STYLE = { bg: 'bg-green-500/10', border: 'border-green-600', dot: 'bg-green-400', dotPulse: false, label: 'Disponible', labelColor: 'text-green-400' }

// Pasos del proceso para mostrar progreso
const STEPS = [
  { key: 'pending',   label: 'Recibida',     icon: ShoppingBag },
  { key: 'preparing', label: 'En cocina',    icon: Flame },
  { key: 'ready',     label: 'Lista',        icon: CheckCircle },
  { key: 'delivered', label: 'Entregada',    icon: PackageCheck },
]

const STEP_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'delivered']

function stepIndex(status: string) {
  return STEP_ORDER.indexOf(status)
}

function elapsed(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'Ahora'
  return `${mins} min`
}

export default function TablesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { setTable, setOrderType } = useOrderStore()
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [showQR, setShowQR] = useState<Table | null>(null)
  const [showAddProducts, setShowAddProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  interface Product { id: string; name: string; price_mxn: number; price_usd?: number; menu_categories?: { name: string } }

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ['products-tables'],
    queryFn: async () => { const { data } = await api.get('/menu/products'); return data.data },
    enabled: showAddProducts,
  })

  useSocket({
    'order:new': (data: unknown) => {
      const o = data as { order_number: string }
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      qc.invalidateQueries({ queryKey: ['tables'] })
      toast(`Nueva orden: ${o.order_number}`, { icon: '🔴', duration: 4000 })
    },
    'order:updated': (data: unknown) => {
      const o = data as { status: string; order_number: string }
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      if (o.status === 'ready') {
        toast(`¡Mesa lista para entregar! ${o.order_number}`, { icon: '✅', duration: 6000 })
      }
    },
    'order:paid': () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })

  const addItemToOrder = useMutation({
    mutationFn: ({ orderId, productId }: { orderId: string; productId: string }) =>
      api.post(`/orders/${orderId}/items`, { product_id: productId, quantity: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      toast.success('Producto agregado')
    },
    onError: () => toast.error('Error al agregar producto'),
  })

  const { data: tables } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: async () => { const { data } = await api.get('/menu/tables'); return data.data },
  })

  const { data: activeOrders } = useQuery<Order[]>({
    queryKey: ['tables-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders')
      return (data.data as Order[]).filter((o: Order) =>
        o.table_id && !['paid', 'cancelled'].includes(o.status)
      )
    },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  })

  const [showPayModal, setShowPayModal] = useState(false)
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [cashReceived, setCashReceived] = useState('')

  const markDelivered = useMutation({
    mutationFn: (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: 'delivered' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      toast.success('Orden marcada como entregada')
    },
  })

  // Cerrar mesa sin cobrar — ya fue pagado en caja
  const closeTableNoPay = useMutation({
    mutationFn: (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: 'paid' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      toast.success('Mesa cerrada')
      setSelectedTable(null)
    },
  })

  // Cerrar mesa cobrando aquí
  const closeTable = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post('/payments', {
        order_id: orderId,
        method: payMethod,
        cash_received: payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) : undefined,
      })
      await api.patch(`/orders/${orderId}/status`, { status: 'paid' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      toast.success('¡Cuenta cobrada! Mesa liberada')
      setSelectedTable(null)
      setShowPayModal(false)
      setCashReceived('')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al cobrar'),
  })

  function getTableOrder(tableId: string) {
    return activeOrders?.find(o => o.table_id === tableId)
  }

  function handleTableClick(table: Table) {
    if (table.status === 'maintenance') return
    const order = getTableOrder(table.id)
    if (order) {
      setSelectedTable(table)
    } else {
      setTable(table.id)
      setOrderType('dine_in')
      router.push('/pos')
    }
  }

  function handleAddMore() {
    if (!selectedTable) return
    setTable(selectedTable.id)
    setOrderType('dine_in')
    setSelectedTable(null)
    router.push('/pos')
  }

  const available = tables?.filter(t => !getTableOrder(t.id) && t.status === 'available').length ?? 0
  const occupied  = tables?.filter(t => !!getTableOrder(t.id)).length ?? 0
  const selectedOrder = selectedTable ? getTableOrder(selectedTable.id) : null

  const { data: orderPayments } = useQuery<{ id: string }[]>({
    queryKey: ['order-payments', selectedOrder?.id],
    queryFn: async () => {
      const { data } = await api.get(`/payments/order/${selectedOrder!.id}`)
      return data.data
    },
    enabled: !!selectedOrder,
  })
  const alreadyPaid = (orderPayments?.length ?? 0) > 0
  const sym = selectedOrder?.currency === 'USD' ? 'USD ' : '$'
  const currentStep = selectedOrder ? stepIndex(selectedOrder.status) : -1

  return (
    <div className="h-full flex">
      {/* Grid de mesas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
          <LayoutGrid className="text-orange-400" size={20} />
          <h1 className="text-lg font-bold text-white">Plano de Mesas</h1>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 rounded-full bg-green-400" />{available} libres</span>
            <span className="flex items-center gap-1.5 text-orange-400"><span className="w-2 h-2 rounded-full bg-orange-400" />{occupied} ocupadas</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {tables?.map((table) => {
              const order = getTableOrder(table.id)
              const cfg = order ? ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE['pending'] : AVAILABLE_STYLE
              const isSelected = selectedTable?.id === table.id
              const mins = order ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000) : null

              return (
                <button
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  disabled={table.status === 'maintenance'}
                  className={`border-2 rounded-2xl p-4 text-left transition hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed ${cfg.bg} ${cfg.border} ${isSelected ? 'ring-2 ring-white/40' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-3 h-3 rounded-full ${cfg.dot} ${cfg.dotPulse ? 'animate-pulse' : ''}`} />
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Users size={11} />{table.capacity}
                    </div>
                  </div>

                  <p className="text-2xl font-black text-white">{table.number}</p>
                  <p className={`text-xs font-semibold mt-1 ${cfg.labelColor}`}>{cfg.label}</p>

                  {order && (
                    <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                      {order.order_items.slice(0, 3).map(item => (
                        <div key={item.id} className="flex items-center gap-1.5 text-xs">
                          <span className="bg-orange-500 text-white font-bold w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-[10px]">
                            {item.quantity}
                          </span>
                          <span className="text-gray-300 truncate">{item.menu_products.name}</span>
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <p className="text-xs text-gray-500">+{order.order_items.length - 3} más</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-orange-400 font-bold text-sm">{sym}{Number(order.total).toFixed(2)}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-0.5"><Clock size={10} />{mins}m</span>
                      </div>
                    </div>
                  )}

                  {!order && table.status === 'available' && (
                    <div className="mt-3 flex items-center justify-center">
                      <Plus size={16} className="text-green-400 opacity-60" />
                    </div>
                  )}

                  {/* Botón QR */}
                  <div
                    role="button"
                    onClick={e => { e.stopPropagation(); setShowQR(table) }}
                    className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-orange-400 transition py-1 cursor-pointer"
                  >
                    <QrCode size={11} /> QR
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      {selectedTable && selectedOrder && (
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white text-base">Mesa {selectedTable.number}</h2>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock size={11} /> {elapsed(selectedOrder.created_at)} · {selectedOrder.order_number}
              </p>
            </div>
            <button onClick={() => setSelectedTable(null)} className="text-gray-400 hover:text-white transition">
              <X size={18} />
            </button>
          </div>

          {/* Progreso */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-1">
              {STEPS.map((step, i) => {
                const done = i <= currentStep
                const active = i === currentStep
                const Icon = step.icon
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                        active  ? 'border-orange-500 bg-orange-500/20 text-orange-400' :
                        done    ? 'border-green-500 bg-green-500/20 text-green-400' :
                                  'border-gray-700 bg-gray-800 text-gray-600'
                      }`}>
                        <Icon size={14} />
                      </div>
                      <p className={`text-[10px] mt-1 text-center leading-tight ${
                        active ? 'text-orange-400 font-bold' : done ? 'text-green-400' : 'text-gray-600'
                      }`}>{step.label}</p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mb-4 mx-0.5 rounded ${i < currentStep ? 'bg-green-500' : 'bg-gray-700'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabs: Pedido / Agregar */}
          <div className="flex border-b border-gray-800">
            <button onClick={() => setShowAddProducts(false)}
              className={`flex-1 py-2 text-xs font-semibold transition ${!showAddProducts ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}>
              Pedido actual
            </button>
            {!['paid', 'cancelled', 'delivered'].includes(selectedOrder.status) && (
              <button onClick={() => setShowAddProducts(true)}
                className={`flex-1 py-2 text-xs font-semibold transition ${showAddProducts ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}>
                + Agregar productos
              </button>
            )}
          </div>

          {!showAddProducts ? (
            /* Lista de lo pedido */
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedOrder.order_items.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
                  <span className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {item.quantity}
                  </span>
                  <p className="flex-1 text-sm text-white font-medium">{item.menu_products.name}</p>
                  <p className="text-orange-400 text-sm font-semibold">{sym}{Number(item.subtotal).toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            /* Agregar productos */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {allProducts?.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                  const price = selectedOrder.currency === 'USD' ? (p.price_usd ?? p.price_mxn / 17) : p.price_mxn
                  return (
                    <button key={p.id}
                      onClick={() => addItemToOrder.mutate({ orderId: selectedOrder.id, productId: p.id })}
                      className="w-full flex items-center justify-between gap-2 bg-gray-800 hover:bg-gray-700 rounded-xl px-3 py-2.5 transition"
                    >
                      <div className="text-left">
                        <p className="text-sm text-white font-medium">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.menu_categories?.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-orange-400 font-bold text-sm">{sym}{price.toFixed(2)}</span>
                        <span className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                          <Plus size={13} className="text-white" />
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Totales y acciones */}
          <div className="p-4 border-t border-gray-800 space-y-2">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span><span>{sym}{Number(selectedOrder.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>IVA (16%)</span><span>{sym}{Number(selectedOrder.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-gray-700">
                <span>Total</span>
                <span className="text-orange-400">{sym}{Number(selectedOrder.total).toFixed(2)}</span>
              </div>
            </div>

            {/* Marcar entregada — solo cuando está lista */}
            {selectedOrder.status === 'ready' && (
              <button onClick={() => markDelivered.mutate(selectedOrder.id)} disabled={markDelivered.isPending}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                <PackageCheck size={15} /> Marcar entregada
              </button>
            )}

            {/* Botones de cierre según si ya fue pagado o no */}
            {!['paid', 'cancelled'].includes(selectedOrder.status) && (
              alreadyPaid ? (
                /* Ya se cobró en caja — solo cerrar mesa */
                <button onClick={() => closeTableNoPay.mutate(selectedOrder.id)} disabled={closeTableNoPay.isPending}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle size={15} /> Cerrar mesa (ya cobrado)
                </button>
              ) : (
                /* No se ha cobrado — mostrar opción de cobrar */
                <button onClick={() => setShowPayModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                  <Receipt size={15} /> Cobrar y cerrar mesa
                </button>
              )
            )}

            {/* Orden ya cerrada */}
            {['paid', 'cancelled'].includes(selectedOrder.status) && (
              <div className="w-full bg-gray-800 border border-gray-700 text-gray-500 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm cursor-not-allowed">
                <CheckCircle size={15} className="text-green-500" />
                {selectedOrder.status === 'paid' ? 'Mesa cerrada ✓' : 'Orden cancelada'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal QR */}
      {showQR && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center space-y-4">
            <div>
              <p className="font-black text-gray-900 text-xl">Mesa {showQR.number}</p>
              <p className="text-gray-500 text-sm">{showQR.name} · Escanea para ordenar</p>
            </div>
            <div className="flex justify-center p-3 bg-white rounded-2xl">
              <QRCodeSVG
                value={`${typeof window !== 'undefined' ? window.location.origin.replace('localhost', '192.168.1.245') : 'http://192.168.1.245:3000'}/order/tacos-el-guero/${showQR.id}`}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-xs text-gray-400">El cliente escanea este código y puede ordenar directamente desde su celular</p>
            <button onClick={() => setShowQR(null)}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal cerrar cuenta */}
      {showPayModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white text-lg">Cerrar cuenta</h2>
                <p className="text-xs text-gray-400">Mesa {selectedTable?.number} · {selectedOrder.order_number}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Total a cobrar</p>
                <p className="text-3xl font-black text-orange-400">
                  {selectedOrder.currency === 'USD' ? 'USD ' : '$'}{Number(selectedOrder.total).toFixed(2)}
                </p>
              </div>

              {/* Método de pago */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Método de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'cash' as const, label: 'Efectivo' },
                    { key: 'card' as const, label: 'Tarjeta' },
                    { key: 'transfer' as const, label: 'Transfer' },
                  ]).map(({ key, label }) => (
                    <button key={key} onClick={() => setPayMethod(key)}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition ${payMethod === key ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {payMethod === 'cash' && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Monto recibido</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                      placeholder={Number(selectedOrder.total).toFixed(2)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-orange-500" autoFocus />
                  </div>
                  {cashReceived && parseFloat(cashReceived) >= selectedOrder.total && (
                    <p className="text-green-400 text-sm mt-1.5 font-medium">
                      Cambio: ${(parseFloat(cashReceived) - Number(selectedOrder.total)).toFixed(2)}
                    </p>
                  )}
                  {cashReceived && parseFloat(cashReceived) < selectedOrder.total && (
                    <p className="text-red-400 text-sm mt-1.5">
                      Faltan: ${(Number(selectedOrder.total) - parseFloat(cashReceived)).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => closeTable.mutate(selectedOrder.id)}
                disabled={closeTable.isPending || (payMethod === 'cash' && !!cashReceived && parseFloat(cashReceived) < selectedOrder.total)}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Receipt size={16} /> {closeTable.isPending ? 'Procesando...' : 'Cobrar y liberar mesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
