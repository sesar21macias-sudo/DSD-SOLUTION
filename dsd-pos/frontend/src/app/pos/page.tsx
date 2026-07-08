'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useOrderStore } from '@/store/order'
import { useSocket } from '@/hooks/useSocket'
import { useT } from '@/lib/i18n/useT'
import toast from 'react-hot-toast'
import {
  Plus, Minus, Trash2, ShoppingBag, ChevronRight, X,
  Banknote, CreditCard, Smartphone, Bell, LayoutGrid,
  Pencil, Check, PackageOpen, Search, Star
} from 'lucide-react'

interface Category { id: string; name: string }
interface Product  { id: string; name: string; description?: string; price_mxn: number; price_usd?: number }
interface Table    { id: string; number: number; name: string }

type PaymentMethod = 'cash' | 'card' | 'transfer'

// ── Shared styles ──────────────────────────────────────────────────────────────
const card: React.CSSProperties   = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px' }
const input: React.CSSProperties  = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: '#111827', outline: 'none', width: '100%' }
const pill = (active: boolean): React.CSSProperties => active
  ? { background: '#111827', color: '#ffffff', borderRadius: '99px', padding: '5px 14px', fontSize: '12px', fontWeight: 600 }
  : { background: '#f0f2f5', color: '#6b7280',  borderRadius: '99px', padding: '5px 14px', fontSize: '12px', fontWeight: 500 }

export default function PosPage() {
  const qc = useQueryClient()
  const { t } = useT()
  const [activeCategory, setActiveCategory]   = useState<string | null>(null)
  const [search,         setSearch]           = useState('')
  const [showPayModal,   setShowPayModal]     = useState(false)
  const [showTablePicker,setShowTablePicker]  = useState(false)
  const [payMethod,      setPayMethod]        = useState<PaymentMethod>('cash')
  const [cashReceived,   setCashReceived]     = useState('')
  const [lastOrder,      setLastOrder]        = useState<{ id: string; total: number; currency: string } | null>(null)
  const [change,         setChange]           = useState<number | null>(null)
  const [readyAlert,     setReadyAlert]       = useState<string | null>(null)
  const [customerPhone,  setCustomerPhone]    = useState('')

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
        type: orderType, currency,
        table_id: tableId ?? undefined,
        customer_phone: customerPhone.trim() || undefined,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })),
      })
      return data.data
    },
    onSuccess: (order) => {
      setLastOrder({ id: order.id, total: order.total, currency: order.currency })
      setShowPayModal(true); setCashReceived(''); setChange(null); setPayMethod('cash')
    },
    onError: () => toast.error('Error al crear la orden'),
  })

  const processPayment = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/payments', {
        order_id: lastOrder!.id, method: payMethod,
        cash_received: payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) : undefined,
      })
      return data.data
    },
    onSuccess: (data) => {
      if (data.change > 0) { setChange(data.change) }
      else { toast.success('¡Pago registrado!'); setShowPayModal(false); clear(); setLastOrder(null); setCustomerPhone('') }
      qc.invalidateQueries({ queryKey: ['all-orders'] })
      qc.invalidateQueries({ queryKey: ['tables-orders'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al procesar pago')
    },
  })

  const subtotal   = total()
  const tax        = subtotal * 0.16
  const grandTotal = subtotal + tax
  const sym        = currency === 'MXN' ? '$' : 'USD '

  const filtered = products?.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const payMethods: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { key: 'cash',     label: t('pos.cash'),     icon: <Banknote size={18} /> },
    { key: 'card',     label: t('pos.card'),     icon: <CreditCard size={18} /> },
    { key: 'transfer', label: t('pos.transfer'), icon: <Smartphone size={18} /> },
  ]

  return (
    <div className="flex h-full" style={{ background: '#f5f6fa' }}>

      {/* Ready alert */}
      {readyAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl"
          style={{ background: '#16a34a' }}>
          <Bell size={16} />
          Orden {readyAlert} lista para entregar
          <button onClick={() => setReadyAlert(null)} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* ── Left: Products ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pos.searchPlaceholder')}
              style={{ ...input, paddingLeft: '34px' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </div>
          {/* Currency toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f0f2f5' }}>
            {(['MXN', 'USD'] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)} style={pill(currency === c)}
                className="transition-all duration-150">{c}</button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 py-2.5 flex gap-2 overflow-x-auto" style={{ background: '#ffffff', borderBottom: '1px solid #f0f2f5' }}>
          <button onClick={() => setActiveCategory(null)} style={pill(!activeCategory)} className="flex-shrink-0 transition-all">{t('pos.categoryAll')}</button>
          {categories?.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              style={pill(activeCategory === cat.id)} className="flex-shrink-0 transition-all whitespace-nowrap">
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40" style={{ color: '#d1d5db' }}>
              <ShoppingBag size={32} className="mb-2 opacity-40" />
              <p className="text-sm">{t('pos.noResults')}</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered?.map(product => {
              const price  = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
              const inCart = items.find(i => i.product_id === product.id)
              return (
                <button key={product.id}
                  onClick={() => addItem({ product_id: product.id, name: product.name, price })}
                  className="relative text-left rounded-2xl p-4 transition-all duration-150"
                  style={inCart ? {
                    background: '#111827', border: '1px solid #111827',
                    boxShadow: '0 4px 12px rgba(17,24,39,0.15)',
                  } : {
                    background: '#ffffff', border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                  {inCart && (
                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black bg-white"
                      style={{ color: '#111827' }}>
                      {inCart.quantity}
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: inCart ? 'rgba(255,255,255,0.1)' : '#f0f2f5' }}>
                    <ShoppingBag size={16} style={{ color: inCart ? '#ffffff' : '#6b7280' }} />
                  </div>
                  <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: inCart ? '#ffffff' : '#111827' }}>
                    {product.name}
                  </p>
                  {product.description && (
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: inCart ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                      {product.description}
                    </p>
                  )}
                  <p className="font-bold mt-2 text-sm" style={{ color: inCart ? '#f97316' : '#111827' }}>
                    {sym}{price.toFixed(2)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Right: Cart ── */}
      <div className="w-72 xl:w-80 flex flex-col" style={{ background: '#ffffff', borderLeft: '1px solid #e5e7eb' }}>

        {/* Order type + table selector */}
        <div className="p-3 space-y-2" style={{ borderBottom: '1px solid #f0f2f5' }}>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ background: '#f0f2f5' }}>
            {([
              { key: 'dine_in',  labelKey: 'pos.table'    as const, icon: <LayoutGrid size={12} /> },
              { key: 'takeout',  labelKey: 'pos.takeout'  as const, icon: <PackageOpen size={12} /> },
              { key: 'delivery', labelKey: 'pos.delivery' as const, icon: <ShoppingBag size={12} /> },
            ] as const).map(({ key, labelKey, icon }) => (
              <button key={key} onClick={() => { setOrderType(key); if (key !== 'dine_in') setTable(null) }}
                className="flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
                style={orderType === key
                  ? { background: '#111827', color: '#ffffff' }
                  : { color: '#9ca3af' }}>
                {icon}{t(labelKey)}
              </button>
            ))}
          </div>

          {orderType === 'dine_in' && (
            <div className="relative">
              <button onClick={() => setShowTablePicker(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={tableId
                  ? { background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }
                  : { background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                <div className="flex items-center gap-2">
                  <LayoutGrid size={13} />
                  {selectedTableInfo ? `${t('pos.table')} ${selectedTableInfo.number} — ${selectedTableInfo.name}` : t('pos.selectTable')}
                </div>
                <Pencil size={12} className="opacity-50" />
              </button>
              {showTablePicker && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto"
                  style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <button onClick={() => { setTable(null); setShowTablePicker(false) }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition"
                    style={{ color: '#6b7280' }}>
                    <X size={12} /> {t('pos.noTable')}
                  </button>
                  <div style={{ borderTop: '1px solid #f0f2f5', margin: '0 8px' }} />
                  <div className="grid grid-cols-4 gap-1.5 p-2">
                    {tables?.map(t => (
                      <button key={t.id} onClick={() => { setTable(t.id); setShowTablePicker(false) }}
                        className="py-2.5 rounded-lg text-sm font-bold transition-all"
                        style={tableId === t.id
                          ? { background: '#111827', color: '#ffffff' }
                          : { background: '#f0f2f5', color: '#374151' }}>
                        {t.number}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f2f5' }}>
          <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: '#111827' }}>
            <ShoppingBag size={14} style={{ color: '#6b7280' }} />
            {t('pos.currentOrder')}
          </h2>
          {items.length > 0 && (
            <span className="text-xs text-white px-2 py-0.5 rounded-full font-bold" style={{ background: '#111827' }}>
              {items.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>

        {/* Teléfono del cliente (opcional, acumula puntos de lealtad) */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Star size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              placeholder={t('pos.customerPhone')}
              style={{ ...input, paddingLeft: '30px', fontSize: '12px' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: '#d1d5db' }}>
              <ShoppingBag size={36} className="mb-2 opacity-30" />
              <p className="text-xs">{t('pos.emptyCart')}</p>
            </div>
          ) : items.map(item => (
            <div key={item.product_id} className="rounded-xl p-3" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium flex-1 leading-snug" style={{ color: '#111827' }}>{item.name}</p>
                <button onClick={() => removeItem(item.product_id)} className="transition-colors flex-shrink-0 mt-0.5"
                  style={{ color: '#d1d5db' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition"
                    style={{ background: '#f0f2f5', color: '#6b7280' }}>
                    <Minus size={11} />
                  </button>
                  <span className="text-sm font-bold w-5 text-center" style={{ color: '#111827' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition"
                    style={{ background: '#f0f2f5', color: '#111827' }}>
                    <Plus size={11} />
                  </button>
                </div>
                <p className="text-sm font-bold" style={{ color: '#111827' }}>{sym}{(item.price * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals + action */}
        <div className="p-4 space-y-3" style={{ borderTop: '1px solid #e5e7eb' }}>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between" style={{ color: '#6b7280' }}>
              <span>{t('pos.subtotal')}</span><span>{sym}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between" style={{ color: '#6b7280' }}>
              <span>{t('pos.tax')}</span><span>{sym}{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2" style={{ color: '#111827', borderTop: '1px solid #f0f2f5' }}>
              <span>{t('pos.total')}</span>
              <span>{sym}{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            disabled={items.length === 0 || createOrder.isPending}
            onClick={() => createOrder.mutate()}
            className="w-full text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-30"
            style={{ background: '#111827', boxShadow: items.length > 0 ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
            {createOrder.isPending ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
              </svg>{t('pos.sending')}</>
            ) : <>{t('pos.orderAndCharge')} <ChevronRight size={15} /></>}
          </button>

          {items.length > 0 && (
            <button onClick={clear} className="w-full text-xs py-1 transition-colors"
              style={{ color: '#d1d5db' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
              {t('pos.clearOrder')}
            </button>
          )}
        </div>
      </div>

      {/* ── Payment modal ── */}
      {showPayModal && lastOrder && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' }}>

            <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f2f5' }}>
              <h2 className="font-bold text-lg" style={{ color: '#111827' }}>{t('pos.checkout')}</h2>
              {change === null && (
                <button onClick={() => { setShowPayModal(false); clear(); setLastOrder(null); setCustomerPhone('') }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                  style={{ color: '#9ca3af', background: '#f9fafb' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}>
                  <X size={16} />
                </button>
              )}
            </div>

            {change !== null ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: '#f0fdf4' }}>
                  <Banknote size={28} style={{ color: '#16a34a' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#6b7280' }}>{t('pos.changeToGive')}</p>
                  <p className="text-5xl font-black" style={{ color: '#16a34a' }}>
                    {lastOrder.currency === 'USD' ? 'USD ' : '$'}{change.toFixed(2)}
                  </p>
                </div>
                <button onClick={() => { setShowPayModal(false); clear(); setLastOrder(null); setChange(null); setCustomerPhone('') }}
                  className="w-full text-white font-bold py-3 rounded-xl transition"
                  style={{ background: '#16a34a' }}>
                  {t('pos.done')}
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="rounded-xl p-4 text-center" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>{t('pos.totalToCharge')}</p>
                  <p className="text-4xl font-black" style={{ color: '#111827' }}>
                    {lastOrder.currency === 'USD' ? 'USD ' : '$'}{Number(lastOrder.total).toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>{t('pos.paymentMethod')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {payMethods.map(({ key, label, icon }) => (
                      <button key={key} onClick={() => setPayMethod(key)}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all"
                        style={payMethod === key
                          ? { background: '#111827', color: '#ffffff', border: '1px solid #111827' }
                          : { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                </div>

                {payMethod === 'cash' && (
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>{t('pos.amountReceived')}</p>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: '#6b7280' }}>$</span>
                      <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                        placeholder={Number(lastOrder.total).toFixed(2)} autoFocus
                        style={{ ...input, paddingLeft: '28px', fontSize: '20px', fontWeight: 700 }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                    </div>
                    {cashReceived && parseFloat(cashReceived) >= lastOrder.total && (
                      <p className="text-sm mt-2 font-semibold" style={{ color: '#16a34a' }}>
                        {t('pos.change')}: ${(parseFloat(cashReceived) - lastOrder.total).toFixed(2)}
                      </p>
                    )}
                    {cashReceived && parseFloat(cashReceived) < lastOrder.total && (
                      <p className="text-sm mt-2" style={{ color: '#dc2626' }}>
                        {t('pos.missing')}: ${(lastOrder.total - parseFloat(cashReceived)).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => processPayment.mutate()}
                  disabled={processPayment.isPending || (payMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < lastOrder.total))}
                  className="w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-30"
                  style={{ background: '#16a34a' }}>
                  <Check size={15} />
                  {processPayment.isPending ? t('pos.processing') : t('pos.confirmPayment')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
