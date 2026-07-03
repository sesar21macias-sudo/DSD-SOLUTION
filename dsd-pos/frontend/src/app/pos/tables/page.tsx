'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import { useRouter } from 'next/navigation'
import { useOrderStore } from '@/store/order'
import toast from 'react-hot-toast'
import { Users, Plus, LayoutGrid, X, Clock, ShoppingBag, Flame, CheckCircle, PackageCheck, Receipt, Search, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface Table { id: string; number: number; name: string; capacity: number; status: string }
interface OrderItem { id: string; quantity: number; subtotal: number; menu_products: { name: string } }
interface Order {
  id: string; table_id: string; order_number: string; status: string
  subtotal: number; tax: number; total: number; currency: string; created_at: string
  order_items: OrderItem[]
}

const ORDER_STATUS_STYLE: Record<string, { bg: string; border: string; dot: string; dotPulse: boolean; label: string; labelColor: string; textColor: string }> = {
  pending:   { bg: '#fff7f7', border: '#fca5a5', dot: '#ef4444', dotPulse: true,  label: '⚡ Nueva',      labelColor: '#dc2626', textColor: '#111827' },
  confirmed: { bg: '#fff7f7', border: '#fca5a5', dot: '#ef4444', dotPulse: true,  label: '⚡ Confirmada', labelColor: '#dc2626', textColor: '#111827' },
  preparing: { bg: '#fff7ed', border: '#fdba74', dot: '#f97316', dotPulse: true,  label: '🔥 En cocina', labelColor: '#c2410c', textColor: '#111827' },
  ready:     { bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', dotPulse: true,  label: '✅ Lista',      labelColor: '#b45309', textColor: '#111827' },
  delivered: { bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6', dotPulse: false, label: '📦 Entregada',  labelColor: '#1d4ed8', textColor: '#111827' },
}
const AVAILABLE_STYLE = { bg: '#f9fafb', border: '#e5e7eb', dot: '#22c55e', dotPulse: false, label: 'Disponible', labelColor: '#15803d', textColor: '#9ca3af' }

const STEPS = [
  { key: 'pending',   label: 'Recibida',  icon: ShoppingBag },
  { key: 'preparing', label: 'En cocina', icon: Flame },
  { key: 'ready',     label: 'Lista',     icon: CheckCircle },
  { key: 'delivered', label: 'Entregada', icon: PackageCheck },
]
const STEP_ORDER = ['pending','confirmed','preparing','ready','delivered']
function stepIndex(status: string) { return STEP_ORDER.indexOf(status) }
function elapsed(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  return m < 1 ? 'Ahora' : `${m} min`
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
      qc.invalidateQueries({ queryKey: ['tables-orders'] }); qc.invalidateQueries({ queryKey: ['tables'] })
      toast(`Nueva orden: ${(data as { order_number: string }).order_number}`, { icon: '🔴', duration: 4000 })
    },
    'order:updated': (data: unknown) => {
      const o = data as { status: string; order_number: string }
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
      if (o.status === 'ready') toast(`¡Mesa lista! ${o.order_number}`, { icon: '✅', duration: 6000 })
    },
    'order:paid': () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] }); qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })

  const addItemToOrder = useMutation({
    mutationFn: ({ orderId, productId }: { orderId: string; productId: string }) =>
      api.post(`/orders/${orderId}/items`, { product_id: productId, quantity: 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables-orders'] }); toast.success('Producto agregado') },
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
      return (data.data as Order[]).filter((o: Order) => o.table_id && !['paid','cancelled'].includes(o.status))
    },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  })

  const [showPayModal, setShowPayModal] = useState(false)
  const [payMethod, setPayMethod] = useState<'cash'|'card'|'transfer'>('cash')
  const [cashReceived, setCashReceived] = useState('')

  const markDelivered = useMutation({
    mutationFn: (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: 'delivered' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables-orders'] }); toast.success('Orden entregada') },
  })
  const closeTableNoPay = useMutation({
    mutationFn: (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: 'paid' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] }); toast.success('Mesa cerrada'); setSelectedTable(null)
    },
  })
  const closeTable = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post('/payments', { order_id: orderId, method: payMethod, cash_received: payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) : undefined })
      await api.patch(`/orders/${orderId}/status`, { status: 'paid' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables-orders'] }); toast.success('¡Cuenta cobrada! Mesa liberada')
      setSelectedTable(null); setShowPayModal(false); setCashReceived('')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al cobrar'),
  })

  function getTableOrder(tableId: string) { return activeOrders?.find(o => o.table_id === tableId) }
  function handleTableClick(table: Table) {
    if (table.status === 'maintenance') return
    const order = getTableOrder(table.id)
    if (order) { setSelectedTable(table) }
    else { setTable(table.id); setOrderType('dine_in'); router.push('/pos') }
  }

  const available    = tables?.filter(t => !getTableOrder(t.id) && t.status === 'available').length ?? 0
  const occupied     = tables?.filter(t => !!getTableOrder(t.id)).length ?? 0
  const selectedOrder = selectedTable ? getTableOrder(selectedTable.id) : null
  const currentStep  = selectedOrder ? stepIndex(selectedOrder.status) : -1
  const sym          = selectedOrder?.currency === 'USD' ? 'USD ' : '$'

  const { data: orderPayments } = useQuery<{ id: string }[]>({
    queryKey: ['order-payments', selectedOrder?.id],
    queryFn: async () => { const { data } = await api.get(`/payments/order/${selectedOrder!.id}`); return data.data },
    enabled: !!selectedOrder,
  })
  const alreadyPaid = (orderPayments?.length ?? 0) > 0

  return (
    <div className="h-full flex" style={{ background: '#f5f6fa' }}>
      {/* Main grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
            <LayoutGrid size={17} style={{ color: '#374151' }} />
          </div>
          <h1 className="text-base font-bold" style={{ color: '#111827' }}>Plano de Mesas</h1>
          <div className="ml-auto flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"/> {available} libres
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400"/> {occupied} ocupadas
            </span>
          </div>
        </div>

        {/* Table grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {tables?.map(table => {
              const order    = getTableOrder(table.id)
              const cfg      = order ? (ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE['pending']) : AVAILABLE_STYLE
              const isSelected = selectedTable?.id === table.id
              const mins     = order ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000) : null
              const orderSym = order?.currency === 'USD' ? 'USD ' : '$'

              return (
                <button key={table.id} onClick={() => handleTableClick(table)}
                  disabled={table.status === 'maintenance'}
                  className="relative text-left rounded-2xl p-4 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    boxShadow: isSelected ? `0 0 0 2px ${cfg.border}, 0 4px 16px rgba(0,0,0,0.08)` : '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-2 h-2 rounded-full mt-1 ${cfg.dotPulse ? 'animate-pulse' : ''}`}
                      style={{ background: cfg.dot }}/>
                    <div className="flex items-center gap-1 text-xs" style={{ color: '#9ca3af' }}>
                      <Users size={10}/>{table.capacity}
                    </div>
                  </div>

                  <p className="text-3xl font-black leading-none" style={{ color: '#111827' }}>{table.number}</p>
                  <p className="text-xs font-semibold mt-1" style={{ color: cfg.labelColor }}>{cfg.label}</p>

                  {order && (
                    <div className="mt-2.5 pt-2.5 space-y-1" style={{ borderTop: `1px solid ${cfg.border}` }}>
                      {order.order_items.slice(0, 2).map(item => (
                        <div key={item.id} className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded flex items-center justify-center text-white font-black text-[9px] flex-shrink-0"
                            style={{ background: '#111827' }}>
                            {item.quantity}
                          </span>
                          <span className="text-xs truncate" style={{ color: '#6b7280' }}>{item.menu_products.name}</span>
                        </div>
                      ))}
                      {order.order_items.length > 2 && (
                        <p className="text-[10px]" style={{ color: '#9ca3af' }}>+{order.order_items.length - 2} más</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-bold text-xs" style={{ color: '#111827' }}>{orderSym}{Number(order.total).toFixed(2)}</span>
                        <span className="text-[10px] flex items-center gap-0.5"
                          style={{ color: (mins ?? 0) > 20 ? '#dc2626' : (mins ?? 0) > 10 ? '#d97706' : '#9ca3af' }}>
                          <Clock size={9}/>{mins}m
                        </span>
                      </div>
                    </div>
                  )}

                  {!order && table.status === 'available' && (
                    <div className="mt-2 flex items-center justify-center">
                      <Plus size={14} style={{ color: '#22c55e', opacity: 0.6 }}/>
                    </div>
                  )}

                  {/* QR button */}
                  <div role="button" onClick={e => { e.stopPropagation(); setShowQR(table) }}
                    className="mt-2 w-full flex items-center justify-center gap-1 py-1 cursor-pointer rounded-lg"
                    style={{ color: '#d1d5db' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#6b7280')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                    <QrCode size={10}/><span className="text-[10px] font-medium">QR</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Side panel */}
      {selectedTable && selectedOrder && (
        <div className="w-80 flex flex-col" style={{ background: '#ffffff', borderLeft: '1px solid #e5e7eb' }}>
          {/* Panel header */}
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f2f5' }}>
            <div>
              <h2 className="font-bold text-base" style={{ color: '#111827' }}>Mesa {selectedTable.number}</h2>
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#9ca3af' }}>
                <Clock size={11}/> {elapsed(selectedOrder.created_at)} · {selectedOrder.order_number}
              </p>
            </div>
            <button onClick={() => setSelectedTable(null)} className="w-7 h-7 rounded-lg flex items-center justify-center transition"
              style={{ color: '#9ca3af', background: '#f9fafb' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
              <X size={15}/>
            </button>
          </div>

          {/* Progress steps */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #f0f2f5' }}>
            <div className="flex items-center gap-1">
              {STEPS.map((step, i) => {
                const done   = i <= currentStep
                const active = i === currentStep
                const Icon   = step.icon
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 transition"
                        style={active  ? { borderColor: '#f97316', background: '#fff7ed', color: '#c2410c' }
                             : done    ? { borderColor: '#22c55e', background: '#f0fdf4', color: '#15803d' }
                             :           { borderColor: '#e5e7eb', background: '#f9fafb', color: '#d1d5db' }}>
                        <Icon size={12}/>
                      </div>
                      <p className="text-[9px] mt-0.5 text-center leading-tight"
                        style={{ color: active ? '#c2410c' : done ? '#15803d' : '#d1d5db', fontWeight: active ? 700 : 400 }}>
                        {step.label}
                      </p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="h-0.5 flex-1 mb-3.5 mx-0.5 rounded"
                        style={{ background: i < currentStep ? '#22c55e' : '#f0f2f5' }}/>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid #f0f2f5' }}>
            <button onClick={() => setShowAddProducts(false)}
              className="flex-1 py-2.5 text-xs font-semibold transition"
              style={!showAddProducts
                ? { color: '#111827', borderBottom: '2px solid #111827' }
                : { color: '#9ca3af', borderBottom: '2px solid transparent' }}>
              Pedido actual
            </button>
            {!['paid','cancelled','delivered'].includes(selectedOrder.status) && (
              <button onClick={() => setShowAddProducts(true)}
                className="flex-1 py-2.5 text-xs font-semibold transition"
                style={showAddProducts
                  ? { color: '#111827', borderBottom: '2px solid #111827' }
                  : { color: '#9ca3af', borderBottom: '2px solid transparent' }}>
                + Agregar
              </button>
            )}
          </div>

          {!showAddProducts ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {selectedOrder.order_items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                    style={{ background: '#111827' }}>
                    {item.quantity}
                  </span>
                  <p className="flex-1 text-sm font-medium" style={{ color: '#111827' }}>{item.menu_products.name}</p>
                  <p className="text-sm font-semibold" style={{ color: '#374151' }}>{sym}{Number(item.subtotal).toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3" style={{ borderBottom: '1px solid #f0f2f5' }}>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }}/>
                  <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px 8px 32px', fontSize: '13px', color: '#111827', outline: 'none' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {allProducts?.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                  const price = selectedOrder.currency === 'USD' ? (p.price_usd ?? p.price_mxn / 17) : p.price_mxn
                  return (
                    <button key={p.id}
                      onClick={() => addItemToOrder.mutate({ orderId: selectedOrder.id, productId: p.id })}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition"
                      style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0f2f5')}>
                      <div className="text-left">
                        <p className="text-sm font-medium" style={{ color: '#111827' }}>{p.name}</p>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>{p.menu_categories?.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-bold text-sm" style={{ color: '#374151' }}>{sym}{price.toFixed(2)}</span>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: '#111827' }}>
                          <Plus size={12}/>
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Totals + actions */}
          <div className="p-4 space-y-2" style={{ borderTop: '1px solid #f0f2f5' }}>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between" style={{ color: '#6b7280' }}>
                <span>Subtotal</span><span>{sym}{Number(selectedOrder.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between" style={{ color: '#6b7280' }}>
                <span>IVA (16%)</span><span>{sym}{Number(selectedOrder.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1" style={{ borderTop: '1px solid #f0f2f5', color: '#111827' }}>
                <span>Total</span><span>{sym}{Number(selectedOrder.total).toFixed(2)}</span>
              </div>
            </div>

            {selectedOrder.status === 'ready' && (
              <button onClick={() => markDelivered.mutate(selectedOrder.id)} disabled={markDelivered.isPending}
                className="w-full text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: '#16a34a' }}>
                <PackageCheck size={15}/> Marcar entregada
              </button>
            )}

            {!['paid','cancelled'].includes(selectedOrder.status) && (
              alreadyPaid ? (
                <button onClick={() => closeTableNoPay.mutate(selectedOrder.id)} disabled={closeTableNoPay.isPending}
                  className="w-full text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#16a34a' }}>
                  <CheckCircle size={15}/> Cerrar mesa (ya cobrado)
                </button>
              ) : (
                <button onClick={() => setShowPayModal(true)}
                  className="w-full text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                  style={{ background: '#111827' }}>
                  <Receipt size={15}/> Cobrar y cerrar mesa
                </button>
              )
            )}

            {['paid','cancelled'].includes(selectedOrder.status) && (
              <div className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold cursor-not-allowed"
                style={{ background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' }}>
                <CheckCircle size={15} style={{ color: '#22c55e' }}/>
                {selectedOrder.status === 'paid' ? 'Mesa cerrada ✓' : 'Orden cancelada'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-xs rounded-3xl overflow-hidden text-center space-y-4 p-6"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div>
              <p className="font-black text-xl" style={{ color: '#111827' }}>Mesa {showQR.number}</p>
              <p className="text-sm" style={{ color: '#9ca3af' }}>{showQR.name} · Escanea para ordenar</p>
            </div>
            <div className="flex justify-center p-3 rounded-2xl" style={{ background: '#f9fafb' }}>
              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/order/tacos-el-guero/${showQR.id}`}
                size={200} level="H" includeMargin/>
            </div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>El cliente escanea y ordena desde su celular</p>
            <button onClick={() => setShowQR(null)}
              className="w-full text-white font-bold py-3 rounded-xl" style={{ background: '#111827' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Pay modal */}
      {showPayModal && selectedOrder && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f2f5' }}>
              <div>
                <h2 className="font-bold text-lg" style={{ color: '#111827' }}>Cerrar cuenta</h2>
                <p className="text-xs" style={{ color: '#9ca3af' }}>Mesa {selectedTable?.number} · {selectedOrder.order_number}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color: '#9ca3af', background: '#f9fafb' }}><X size={15}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center py-3 rounded-2xl" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>Total a cobrar</p>
                <p className="text-3xl font-black" style={{ color: '#111827' }}>
                  {selectedOrder.currency === 'USD' ? 'USD ' : '$'}{Number(selectedOrder.total).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#6b7280' }}>Método de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash','card','transfer'] as const).map(key => (
                    <button key={key} onClick={() => setPayMethod(key)}
                      className="py-2.5 rounded-xl text-xs font-semibold transition"
                      style={payMethod === key
                        ? { background: '#111827', color: '#ffffff', border: '1px solid #111827' }
                        : { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                      {key === 'cash' ? 'Efectivo' : key === 'card' ? 'Tarjeta' : 'Transfer'}
                    </button>
                  ))}
                </div>
              </div>
              {payMethod === 'cash' && (
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#6b7280' }}>Monto recibido</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-lg" style={{ color: '#9ca3af' }}>$</span>
                    <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                      placeholder={Number(selectedOrder.total).toFixed(2)} autoFocus
                      style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px 12px 36px', fontSize: '20px', fontWeight: 700, color: '#111827', outline: 'none' }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                  </div>
                  {cashReceived && parseFloat(cashReceived) >= selectedOrder.total && (
                    <p className="text-sm mt-1.5 font-semibold" style={{ color: '#16a34a' }}>
                      Cambio: ${(parseFloat(cashReceived) - Number(selectedOrder.total)).toFixed(2)}
                    </p>
                  )}
                  {cashReceived && parseFloat(cashReceived) < selectedOrder.total && (
                    <p className="text-sm mt-1.5" style={{ color: '#dc2626' }}>
                      Faltan: ${(Number(selectedOrder.total) - parseFloat(cashReceived)).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
              <button onClick={() => closeTable.mutate(selectedOrder.id)}
                disabled={closeTable.isPending || (payMethod === 'cash' && !!cashReceived && parseFloat(cashReceived) < selectedOrder.total)}
                className="w-full text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: '#111827' }}>
                <Receipt size={16}/> {closeTable.isPending ? 'Procesando...' : 'Cobrar y liberar mesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
