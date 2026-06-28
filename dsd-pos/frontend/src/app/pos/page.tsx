'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useOrderStore } from '@/store/order'
import { useSocket } from '@/hooks/useSocket'
import toast from 'react-hot-toast'
import {
  Plus, Minus, Trash2, ShoppingBag, ChevronRight, X,
  Banknote, CreditCard, Smartphone, Bell, LayoutGrid,
  Pencil, Check, PackageOpen
} from 'lucide-react'

interface Category { id: string; name: string }
interface Product { id: string; name: string; description?: string; price_mxn: number; price_usd?: number }
interface Table { id: string; number: number; name: string }

type PaymentMethod = 'cash' | 'card' | 'transfer'

export default function PosPage() {
  const qc = useQueryClient()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [lastOrder, setLastOrder] = useState<{ id: string; total: number; currency: string } | null>(null)
  const [change, setChange] = useState<number | null>(null)
  const [readyAlert, setReadyAlert] = useState<string | null>(null)

  const { items, addItem, removeItem, updateQty, total, clear, orderType, setOrderType, currency, setCurrency, tableId, setTable } = useOrderStore()

  useSocket({
    'order:updated': (data: unknown) => {
      const order = data as { status: string; order_number: string }
      if (order.status === 'ready') {
        setReadyAlert(order.order_number)
        toast(`Orden ${order.order_number} lista para entregar`, { duration: 6000, icon: '✅' })
        qc.invalidateQueries({ queryKey: ['all-orders'] })
      }
    },
  })

  const { data: tables } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: async () => { const { data } = await api.get('/menu/tables'); return data.data },
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => { const { data } = await api.get('/menu/categories'); return data.data },
  })

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products', activeCategory],
    queryFn: async () => {
      const url = activeCategory ? `/menu/products?category_id=${activeCategory}` : '/menu/products'
      const { data } = await api.get(url)
      return data.data
    },
  })

  const selectedTableInfo = tables?.find(t => t.id === tableId)

  const createOrder = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/orders', {
        type: orderType,
        currency,
        table_id: tableId ?? undefined,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })),
      })
      return data.data
    },
    onSuccess: (order) => {
      setLastOrder({ id: order.id, total: order.total, currency: order.currency })
      setShowPayModal(true)
      setCashReceived('')
      setChange(null)
      setPayMethod('cash')
    },
    onError: () => toast.error('Error al crear la orden'),
  })

  const processPayment = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/payments', {
        order_id: lastOrder!.id,
        method: payMethod,
        cash_received: payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) : undefined,
      })
      return data.data
    },
    onSuccess: (data) => {
      if (data.change > 0) {
        setChange(data.change)
      } else {
        toast.success('¡Pago registrado!')
        setShowPayModal(false)
        clear()
        setLastOrder(null)
      }
      qc.invalidateQueries({ queryKey: ['all-orders'] })
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al procesar pago'
      toast.error(msg)
    },
  })

  const subtotal = total()
  const tax = subtotal * 0.16
  const grandTotal = subtotal + tax
  const sym = currency === 'MXN' ? '$' : 'USD '

  const payMethods: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { key: 'cash',     label: 'Efectivo',       icon: <Banknote size={18} /> },
    { key: 'card',     label: 'Tarjeta',         icon: <CreditCard size={18} /> },
    { key: 'transfer', label: 'Transferencia',   icon: <Smartphone size={18} /> },
  ]

  return (
    <div className="flex h-full">
      {/* Alerta orden lista */}
      {readyAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <Bell size={18} />
          <span className="font-bold">Orden {readyAlert} lista para entregar</span>
          <button onClick={() => setReadyAlert(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      {/* Left — Products */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Moneda */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-end gap-2">
          <span className="text-xs text-gray-500 mr-1">Moneda:</span>
          {(['MXN', 'USD'] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${currency === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Categorías */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${!activeCategory ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Todo
          </button>
          {categories?.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${activeCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Productos */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products?.map((product) => {
              const price = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
              const inCart = items.find(i => i.product_id === product.id)
              return (
                <button key={product.id} onClick={() => addItem({ product_id: product.id, name: product.name, price })}
                  className={`relative bg-gray-900 border rounded-xl p-4 text-left transition hover:border-orange-500 hover:bg-gray-800 ${inCart ? 'border-orange-500' : 'border-gray-700'}`}>
                  {inCart && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full text-xs flex items-center justify-center font-bold text-white">
                      {inCart.quantity}
                    </span>
                  )}
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mb-3">
                    <ShoppingBag size={18} className="text-orange-400" />
                  </div>
                  <p className="text-sm font-semibold text-white leading-tight">{product.name}</p>
                  {product.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.description}</p>}
                  <p className="text-orange-400 font-bold mt-2 text-sm">{sym}{price.toFixed(2)}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-72 xl:w-80 bg-gray-900 border-l border-gray-800 flex flex-col">

        {/* ── Selector de Mesa / Tipo ─────────────────────────── */}
        <div className="p-3 border-b border-gray-800 space-y-2">
          {/* Tipo de orden */}
          <div className="grid grid-cols-3 gap-1">
            {([
              { key: 'dine_in',  label: 'Mesa',       icon: <LayoutGrid size={13} /> },
              { key: 'takeout',  label: 'Para llevar', icon: <PackageOpen size={13} /> },
              { key: 'delivery', label: 'Delivery',    icon: <ShoppingBag size={13} /> },
            ] as const).map(({ key, label, icon }) => (
              <button key={key} onClick={() => { setOrderType(key); if (key !== 'dine_in') setTable(null) }}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition ${orderType === key ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Selector de mesa — solo si es dine_in */}
          {orderType === 'dine_in' && (
            <div className="relative">
              <button
                onClick={() => setShowTablePicker(p => !p)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-medium transition ${tableId ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'}`}
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid size={14} />
                  {selectedTableInfo ? `Mesa ${selectedTableInfo.number} — ${selectedTableInfo.name}` : 'Seleccionar mesa'}
                </div>
                <Pencil size={13} className="opacity-50" />
              </button>

              {/* Dropdown de mesas */}
              {showTablePicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { setTable(null); setShowTablePicker(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition flex items-center gap-2"
                  >
                    <X size={13} /> Sin mesa asignada
                  </button>
                  <div className="border-t border-gray-700" />
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {tables?.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setTable(t.id); setShowTablePicker(false) }}
                        className={`py-2.5 rounded-lg text-sm font-bold transition ${tableId === t.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-white hover:bg-orange-500/30'}`}
                      >
                        {t.number}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Título carrito ───────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2 text-sm">
            <ShoppingBag size={15} className="text-orange-400" />
            Orden actual
          </h2>
          {items.length > 0 && (
            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
              {items.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          )}
        </div>

        {/* ── Items del carrito ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <ShoppingBag size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Agrega productos al carrito</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product_id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white flex-1 leading-tight">{item.name}</p>
                  <button onClick={() => removeItem(item.product_id)} className="text-gray-600 hover:text-red-400 transition flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-6 h-6 rounded-md bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition">
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-6 h-6 rounded-md bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition">
                      <Plus size={12} />
                    </button>
                  </div>
                  <p className="text-orange-400 text-sm font-semibold">{sym}{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Totales y acción ─────────────────────────────────── */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>IVA (16%)</span><span>{sym}{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-gray-700">
              <span>Total</span><span className="text-orange-400">{sym}{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            disabled={items.length === 0 || createOrder.isPending}
            onClick={() => createOrder.mutate()}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            {createOrder.isPending ? 'Enviando...' : 'Ordenar y cobrar'}
            <ChevronRight size={16} />
          </button>

          {items.length > 0 && (
            <button onClick={clear} className="w-full text-gray-500 hover:text-red-400 text-sm py-1 transition">
              Limpiar orden
            </button>
          )}
        </div>
      </div>

      {/* ── Modal de cobro ───────────────────────────────────────── */}
      {showPayModal && lastOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">Cobro</h2>
              {change === null && (
                <button onClick={() => { setShowPayModal(false); clear(); setLastOrder(null) }} className="text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              )}
            </div>

            {change !== null ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Banknote size={28} className="text-green-400" />
                </div>
                <p className="text-gray-400 text-sm">Cambio a entregar</p>
                <p className="text-4xl font-black text-green-400">
                  {lastOrder.currency === 'USD' ? 'USD ' : '$'}{change.toFixed(2)}
                </p>
                <button onClick={() => { setShowPayModal(false); clear(); setLastOrder(null); setChange(null) }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition">
                  Listo ✓
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-sm mb-1">Total a cobrar</p>
                  <p className="text-3xl font-black text-orange-400">
                    {lastOrder.currency === 'USD' ? 'USD ' : '$'}{Number(lastOrder.total).toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-2">Método de pago</p>
                  <div className="grid grid-cols-3 gap-2">
                    {payMethods.map(({ key, label, icon }) => (
                      <button key={key} onClick={() => setPayMethod(key)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition ${payMethod === key ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                        {icon}{label}
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
                        placeholder={Number(lastOrder.total).toFixed(2)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-orange-500" autoFocus />
                    </div>
                    {cashReceived && parseFloat(cashReceived) >= lastOrder.total && (
                      <p className="text-green-400 text-sm mt-1.5 font-medium">
                        Cambio: ${(parseFloat(cashReceived) - lastOrder.total).toFixed(2)}
                      </p>
                    )}
                    {cashReceived && parseFloat(cashReceived) < lastOrder.total && (
                      <p className="text-red-400 text-sm mt-1.5">
                        Faltan: ${(lastOrder.total - parseFloat(cashReceived)).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => processPayment.mutate()}
                  disabled={processPayment.isPending || (payMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < lastOrder.total))}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Check size={15} /> {processPayment.isPending ? 'Procesando...' : 'Confirmar pago'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
