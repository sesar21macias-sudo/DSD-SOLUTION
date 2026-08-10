'use client'

import { useState, use } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { ShoppingBag, Plus, Minus, X, CheckCircle2, UtensilsCrossed, MapPin, Phone } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
const pub = axios.create({ baseURL: API_BASE })

interface Category { id: string; name: string; sort_order: number }
interface Product { id: string; name: string; description?: string; price_mxn: number; category_id: string; image_url?: string; is_available?: boolean }
interface Tenant {
  id: string; name: string; slug: string; currency: string
  logo_url?: string; description?: string; phone?: string; address?: string
  primary_color?: string; bg_color?: string; surface_color?: string; cover_image_url?: string; slogan?: string
}
interface CartItem { product_id: string; name: string; price: number; quantity: number; photo?: string }

function hex2rgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
function textColorFor(bgHex: string): { text: string; text2: string } {
  const r = parseInt(bgHex.slice(1, 3), 16), g = parseInt(bgHex.slice(3, 5), 16), b = parseInt(bgHex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? { text: '#1a1712', text2: '#6b6455' } : { text: '#f7f1e3', text2: '#b3a68c' }
}

export default function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout'>('takeout')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pub-menu', slug],
    queryFn: async () => {
      const { data } = await pub.get(`/public/menu/${slug}`)
      return data.data as { tenant: Tenant; categories: Category[]; products: Product[] }
    },
    retry: 1,
  })

  const accent = data?.tenant.primary_color ?? '#e8341f'
  const accentRgb = hex2rgb(accent)
  const bg = data?.tenant.bg_color ?? '#17140f'
  const surface = data?.tenant.surface_color ?? '#211c15'
  const { text, text2 } = textColorFor(bg)

  const placeOrder = useMutation({
    mutationFn: async () => {
      const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
      const { data } = await pub.post(`/public/online-order/${slug}`, {
        customer_name: customerName.trim() || 'Cliente', order_type: orderType, items,
      })
      return data.data
    },
    onSuccess: (res) => {
      setOrderNumber(res.order_number ?? res.order_id?.slice(0, 6).toUpperCase() ?? '')
      setShowSuccess(true); setCart([]); setShowCart(false)
    },
    onError: () => alert('No se pudo enviar la orden. Intenta de nuevo.'),
  })

  function addToCart(p: Product) {
    setCart(c => {
      const existing = c.find(i => i.product_id === p.id)
      if (existing) return c.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...c, { product_id: p.id, name: p.name, price: p.price_mxn, quantity: 1, photo: p.image_url }]
    })
  }
  function updateQty(id: string, qty: number) {
    setCart(c => qty <= 0 ? c.filter(i => i.product_id !== id) : c.map(i => i.product_id === id ? { ...i, quantity: qty } : i))
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)

  if (isLoading) {
    return <div style={{ minHeight: '100svh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Cargando...</div>
  }
  if (isError || !data) {
    return (
      <div style={{ minHeight: '100svh', background: '#17140f', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <UtensilsCrossed size={40} color="#b3a68c" />
          <h2 style={{ color: '#f7f1e3', fontSize: 20, fontWeight: 700, marginTop: 12 }}>Restaurante no encontrado</h2>
        </div>
      </div>
    )
  }

  const { tenant, categories, products } = data

  if (showSuccess) {
    return (
      <div style={{ minHeight: '100svh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 24, textAlign: 'center' }}>
        <CheckCircle2 size={48} color={accent} />
        <h1 style={{ fontSize: 26, fontWeight: 800, color: text }}>Orden enviada</h1>
        <div style={{ background: surface, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 22px', color: accent, fontWeight: 700 }}>#{orderNumber}</div>
        <button onClick={() => setShowSuccess(false)} style={{ marginTop: 12, background: accent, color: '#fff', border: 'none', borderRadius: 12, padding: '13px 30px', fontWeight: 700, cursor: 'pointer' }}>
          Ordenar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', background: bg, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      <div style={{ position: 'relative', minHeight: tenant.cover_image_url ? 200 : 'auto', overflow: 'hidden' }}>
        {tenant.cover_image_url && (
          <>
            <img src={tenant.cover_image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 70%, ${bg} 100%)` }} />
          </>
        )}
        <div style={{ position: 'relative', padding: tenant.cover_image_url ? '90px 16px 20px' : '20px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {tenant.logo_url
              ? <img src={tenant.logo_url} alt={tenant.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.12)' }} />
              : <div style={{ width: 48, height: 48, borderRadius: 12, background: `rgba(${accentRgb},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UtensilsCrossed size={20} color={accent} /></div>}
            <div>
              <h1 style={{ color: text, fontSize: 24, fontWeight: 800 }}>{tenant.name}</h1>
              {tenant.slogan && <p style={{ color: text2, fontSize: 12, marginTop: 2 }}>{tenant.slogan}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {tenant.address && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: text2, fontSize: 11 }}><MapPin size={10} /> {tenant.address}</span>}
            {tenant.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: text2, fontSize: 11 }}><Phone size={10} /> {tenant.phone}</span>}
          </div>
        </div>
      </div>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: bg, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: text, fontWeight: 700, fontSize: 14 }}>{tenant.name}</span>
        <button onClick={() => setShowCart(true)} style={{ background: totalItems > 0 ? accent : surface, color: totalItems > 0 ? '#fff' : text2, border: 'none', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <ShoppingBag size={14} /> {totalItems > 0 ? totalItems : ''}
        </button>
      </div>

      <div style={{ padding: '16px', maxWidth: 640, margin: '0 auto' }}>
        {categories.map(cat => {
          const items = products.filter(p => p.category_id === cat.id && p.is_available !== false)
          if (!items.length) return null
          return (
            <div key={cat.id} style={{ marginBottom: 28 }}>
              <h2 style={{ color: text, fontSize: 17, fontWeight: 700, marginBottom: 12 }}>{cat.name}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(p => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ display: 'flex', gap: 12, background: surface, borderRadius: 14, padding: 12, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: text, fontWeight: 700, fontSize: 14 }}>{p.name}</p>
                      {p.description && <p style={{ color: text2, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{p.description}</p>}
                      <p style={{ color: accent, fontWeight: 700, fontSize: 14, marginTop: 6 }}>${p.price_mxn}</p>
                    </div>
                    <button style={{ background: accent, border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', alignSelf: 'center', flexShrink: 0 }}>
                      <Plus size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showCart && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowCart(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 420, background: bg, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 style={{ color: text, fontWeight: 800, fontSize: 17 }}>Tu orden</h2>
              <button onClick={() => setShowCart(false)} style={{ background: surface, border: 'none', width: 32, height: 32, borderRadius: '50%', color: text2, cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
              {cart.length === 0 && <p style={{ color: text2, textAlign: 'center', marginTop: 40, fontSize: 14 }}>Tu carrito esta vacio</p>}
              {cart.map(item => (
                <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: text, fontWeight: 600, fontSize: 13 }}>{item.name}</p>
                    <p style={{ color: text2, fontSize: 12 }}>${item.price} c/u</p>
                  </div>
                  <button onClick={() => updateQty(item.product_id, item.quantity - 1)} style={{ width: 26, height: 26, borderRadius: 7, background: surface, border: 'none', color: text2, cursor: 'pointer' }}><Minus size={11} /></button>
                  <span style={{ color: text, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.quantity + 1)} style={{ width: 26, height: 26, borderRadius: 7, background: surface, border: 'none', color: text2, cursor: 'pointer' }}><Plus size={11} /></button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['takeout', 'dine_in'] as const).map(t => (
                    <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', border: `1px solid ${orderType === t ? accent : 'rgba(255,255,255,0.08)'}`, background: orderType === t ? `rgba(${accentRgb},0.12)` : surface, color: orderType === t ? accent : text2, fontWeight: 600, fontSize: 13 }}>
                      {t === 'takeout' ? 'Para llevar' : 'En mesa'}
                    </button>
                  ))}
                </div>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Tu nombre"
                  style={{ width: '100%', padding: 11, borderRadius: 10, background: surface, border: '1px solid rgba(255,255,255,0.08)', color: text, marginBottom: 12, fontSize: 14 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontWeight: 800, fontSize: 16, color: text }}>
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
                <button onClick={() => placeOrder.mutate()} disabled={placeOrder.isPending}
                  style={{ width: '100%', background: accent, color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {placeOrder.isPending ? 'Enviando...' : 'Confirmar orden'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
