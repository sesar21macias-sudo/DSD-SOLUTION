'use client'

import { useState, use } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { ShoppingBag, Plus, Minus, Trash2, ChevronRight, CheckCircle, X, User } from 'lucide-react'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:4000/api`
  : 'http://localhost:4000/api'

const publicApi = axios.create({ baseURL: API_BASE })

interface Category { id: string; name: string; sort_order: number }
interface Product { id: string; name: string; description?: string; price_mxn: number; price_usd?: number; image_url?: string; category_id: string; preparation_time_min: number }
interface Tenant { id: string; name: string; logo_url?: string; currency: string }
interface CartItem { product_id: string; name: string; price: number; quantity: number; notes?: string }

export default function PublicOrderPage({ params }: { params: Promise<{ slug: string; tableId: string }> }) {
  const { slug, tableId } = use(params)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')

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
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })),
      })
      return data.data
    },
    onSuccess: (data) => {
      setOrderNumber(data.order_number)
      setShowSuccess(true)
      setCart([])
      setShowCart(false)
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
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = subtotal * 0.16
  const total = subtotal + tax
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)

  const filteredProducts = menuData?.products.filter(p => !activeCategory || p.category_id === activeCategory)

  // Pantalla de éxito
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-black text-white">¡Orden enviada!</h1>
          <p className="text-gray-400">Tu orden ha sido recibida. El equipo la está preparando.</p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Número de orden</p>
            <p className="text-2xl font-black text-orange-400">{orderNumber}</p>
            <p className="text-xs text-gray-500 mt-1">Mesa {tableData?.table.number}</p>
          </div>
          <p className="text-sm text-gray-500">Te avisaremos cuando esté lista. ¡Gracias!</p>
          <button onClick={() => setShowSuccess(false)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-2xl transition">
            Hacer otro pedido
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-black text-white text-lg">{menuData?.tenant.name ?? '...'}</p>
            <p className="text-xs text-orange-400">Mesa {tableData?.table.number ?? '...'} · Escanea y ordena</p>
          </div>
          <button onClick={() => setShowCart(true)} className="relative bg-orange-500 hover:bg-orange-600 transition p-2.5 rounded-xl">
            <ShoppingBag size={20} className="text-white" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Categorías */}
        <div className="max-w-lg mx-auto px-4 pb-2 flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${!activeCategory ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Todo
          </button>
          {menuData?.categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${activeCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Productos */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {filteredProducts?.map(product => {
          const price = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
          const inCart = cart.find(i => i.product_id === product.id)
          return (
            <div key={product.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white">{product.name}</p>
                {product.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>}
                <p className="text-orange-400 font-black text-lg mt-1">{sym}{price.toFixed(2)}</p>
              </div>
              {inCart ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => updateQty(product.id, inCart.quantity - 1)}
                    className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition">
                    <Minus size={14} />
                  </button>
                  <span className="text-white font-black w-5 text-center">{inCart.quantity}</span>
                  <button onClick={() => addToCart(product)}
                    className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition">
                    <Plus size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => addToCart(product)}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition">
                  <Plus size={18} className="text-white" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Botón flotante del carrito */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-0 right-0 px-4 max-w-lg mx-auto z-20">
          <button onClick={() => setShowCart(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-2xl transition">
            <span className="bg-orange-600 rounded-xl px-2 py-0.5 text-sm">{totalItems}</span>
            <span>Ver mi orden</span>
            <span className="font-black">{sym}{total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Drawer del carrito */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="relative bg-gray-900 rounded-t-3xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-black text-white text-lg">Mi orden</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {/* Nombre del cliente */}
              <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
                <User size={16} className="text-gray-400 flex-shrink-0" />
                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-500" />
              </div>

              {/* Items */}
              {cart.map(item => (
                <div key={item.product_id} className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{item.name}</p>
                    <p className="text-orange-400 text-sm font-bold">{sym}{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center">
                      <Minus size={13} />
                    </button>
                    <span className="text-white font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
                      <Plus size={13} />
                    </button>
                    <button onClick={() => updateQty(item.product_id, 0)} className="ml-1 text-gray-600 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Notas */}
              <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                placeholder="Notas para la cocina... (alergias, preferencias)"
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none placeholder-gray-500" />

              {/* Totales */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-400"><span>IVA (16%)</span><span>{sym}{tax.toFixed(2)}</span></div>
                <div className="flex justify-between text-white font-black text-base pt-1 border-t border-gray-700">
                  <span>Total</span><span className="text-orange-400">{sym}{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-800">
              <button onClick={() => placeOrder.mutate()} disabled={cart.length === 0 || placeOrder.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition text-lg">
                {placeOrder.isPending ? 'Enviando...' : 'Enviar orden a cocina'}
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
