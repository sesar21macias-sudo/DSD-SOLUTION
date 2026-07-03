'use client'

import { useState, use } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { ShoppingBag, Plus, Minus, Trash2, ChevronRight, CheckCircle, X, User } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

const publicApi = axios.create({ baseURL: API_BASE })

interface Category { id: string; name: string; sort_order: number }
interface Product  { id: string; name: string; description?: string; price_mxn: number; price_usd?: number; category_id: string; preparation_time_min: number }
interface Tenant   { id: string; name: string; currency: string }
interface CartItem { product_id: string; name: string; price: number; quantity: number }

export default function PublicOrderPage({ params }: { params: Promise<{ slug: string; tableId: string }> }) {
  const { slug, tableId } = use(params)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [customerName, setCustomerName]     = useState('')
  const [orderNotes, setOrderNotes]         = useState('')
  const [showCart, setShowCart]             = useState(false)
  const [showSuccess, setShowSuccess]       = useState(false)
  const [orderNumber, setOrderNumber]       = useState('')

  const { data: tableData } = useQuery({
    queryKey: ['table-info', slug, tableId],
    queryFn: async () => {
      const { data } = await publicApi.get(`/public/table/${slug}/${tableId}`)
      return data.data as { tenant: Tenant; table: { number: number; name: string } }
    },
  })
  const { data: menuData } = useQuery({
    queryKey: ['public-menu', slug],
    queryFn: async () => {
      const { data } = await publicApi.get(`/public/menu/${slug}`)
      return data.data as { tenant: Tenant; categories: Category[]; products: Product[] }
    },
  })

  const placeOrder = useMutation({
    mutationFn: async () => {
      const { data } = await publicApi.post(`/public/order/${slug}/${tableId}`, {
        customer_name: customerName || undefined,
        notes: orderNotes || undefined,
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      })
      return data.data
    },
    onSuccess: (data) => {
      setOrderNumber(data.order_number); setShowSuccess(true); setCart([]); setShowCart(false)
    },
  })

  function addToCart(product: Product) {
    const price = menuData?.tenant.currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
    setCart(c => {
      const existing = c.find(i => i.product_id === product.id)
      if (existing) return c.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...c, { product_id: product.id, name: product.name, price, quantity: 1 }]
    })
  }
  function updateQty(productId: string, qty: number) {
    if (qty <= 0) setCart(c => c.filter(i => i.product_id !== productId))
    else setCart(c => c.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
  }

  const currency = menuData?.tenant.currency ?? 'MXN'
  const sym = currency === 'USD' ? 'USD ' : '$'
  const subtotal   = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax        = subtotal * 0.16
  const total      = subtotal + tax
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)
  const filteredProducts = menuData?.products.filter(p => !activeCategory || p.category_id === activeCategory)

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f6fa' }}>
        <div className="text-center space-y-4 w-full max-w-sm">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: '#f0fdf4' }}>
            <CheckCircle size={40} style={{ color: '#16a34a' }}/>
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#111827' }}>¡Orden enviada!</h1>
          <p style={{ color: '#6b7280' }}>Tu orden ha sido recibida. El equipo la está preparando.</p>
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>Número de orden</p>
            <p className="text-3xl font-black" style={{ color: '#111827' }}>{orderNumber}</p>
            <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Mesa {tableData?.table.number}</p>
          </div>
          <p className="text-sm" style={{ color: '#9ca3af' }}>Te avisaremos cuando esté lista. ¡Gracias!</p>
          <button onClick={() => setShowSuccess(false)}
            className="w-full text-white font-bold py-3.5 rounded-2xl transition"
            style={{ background: '#111827' }}>
            Hacer otro pedido
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-black text-lg" style={{ color: '#111827' }}>{menuData?.tenant.name ?? '...'}</p>
            <p className="text-xs font-medium" style={{ color: '#f97316' }}>Mesa {tableData?.table.number ?? '...'} · Ordena aquí</p>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-2.5 rounded-xl transition"
            style={{ background: '#111827' }}>
            <ShoppingBag size={20} className="text-white"/>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 text-white text-xs font-black rounded-full flex items-center justify-center"
                style={{ background: '#ef4444' }}>
                {totalItems}
              </span>
            )}
          </button>
        </div>
        {/* Category pills */}
        <div className="max-w-lg mx-auto px-4 pb-2 flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveCategory(null)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition"
            style={!activeCategory ? { background: '#111827', color: '#ffffff' } : { background: '#f0f2f5', color: '#6b7280' }}>
            Todo
          </button>
          {menuData?.categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition"
              style={activeCategory === cat.id ? { background: '#111827', color: '#ffffff' } : { background: '#f0f2f5', color: '#6b7280' }}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {filteredProducts?.map(product => {
          const price  = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
          const inCart = cart.find(i => i.product_id === product.id)
          return (
            <div key={product.id} className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex-1 min-w-0">
                <p className="font-bold" style={{ color: '#111827' }}>{product.name}</p>
                {product.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#9ca3af' }}>{product.description}</p>}
                <p className="font-black text-lg mt-1" style={{ color: '#111827' }}>{sym}{price.toFixed(2)}</p>
              </div>
              {inCart ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => updateQty(product.id, inCart.quantity - 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition"
                    style={{ background: '#f0f2f5', color: '#374151' }}>
                    <Minus size={14}/>
                  </button>
                  <span className="font-black w-5 text-center" style={{ color: '#111827' }}>{inCart.quantity}</span>
                  <button onClick={() => addToCart(product)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition text-white"
                    style={{ background: '#111827' }}>
                    <Plus size={14}/>
                  </button>
                </div>
              ) : (
                <button onClick={() => addToCart(product)}
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition text-white"
                  style={{ background: '#111827' }}>
                  <Plus size={18}/>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Floating cart button */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-0 right-0 px-4 max-w-lg mx-auto z-20">
          <button onClick={() => setShowCart(true)}
            className="w-full text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition"
            style={{ background: '#111827', boxShadow: '0 8px 32px rgba(0,0,0,0.24)' }}>
            <span className="rounded-xl px-2 py-0.5 text-sm" style={{ background: 'rgba(255,255,255,0.15)' }}>{totalItems}</span>
            <span>Ver mi orden</span>
            <span className="font-black">{sym}{total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowCart(false)}/>
          <div className="relative rounded-t-3xl max-h-[90vh] flex flex-col"
            style={{ background: '#ffffff' }}>
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f2f5' }}>
              <h2 className="font-black text-lg" style={{ color: '#111827' }}>Mi orden</h2>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: '#9ca3af', background: '#f9fafb' }}>
                <X size={18}/>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {/* Customer name */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <User size={15} style={{ color: '#9ca3af' }}/>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  style={{ flex: 1, background: 'transparent', color: '#111827', fontSize: '14px', outline: 'none' }}/>
              </div>

              {/* Cart items */}
              {cart.map(item => (
                <div key={item.product_id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#111827' }}>{item.name}</p>
                    <p className="text-sm font-bold" style={{ color: '#374151' }}>{sym}{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: '#f0f2f5', color: '#374151' }}>
                      <Minus size={12}/>
                    </button>
                    <span className="font-bold w-4 text-center" style={{ color: '#111827' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                      style={{ background: '#111827' }}>
                      <Plus size={12}/>
                    </button>
                    <button onClick={() => updateQty(item.product_id, 0)} className="ml-1 transition"
                      style={{ color: '#d1d5db' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}

              {/* Notes */}
              <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                placeholder="Notas para la cocina... (alergias, preferencias)" rows={2}
                style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', color: '#111827', resize: 'none', outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}/>

              {/* Totals */}
              <div className="rounded-xl p-4 space-y-1.5 text-sm" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                <div className="flex justify-between" style={{ color: '#6b7280' }}>
                  <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between" style={{ color: '#6b7280' }}>
                  <span>IVA (16%)</span><span>{sym}{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-base pt-1" style={{ borderTop: '1px solid #e5e7eb', color: '#111827' }}>
                  <span>Total</span><span>{sym}{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4" style={{ borderTop: '1px solid #f0f2f5' }}>
              <button onClick={() => placeOrder.mutate()} disabled={cart.length === 0 || placeOrder.isPending}
                className="w-full text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition text-lg disabled:opacity-40"
                style={{ background: '#111827' }}>
                {placeOrder.isPending ? 'Enviando...' : 'Enviar orden a cocina'}
                <ChevronRight size={20}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
