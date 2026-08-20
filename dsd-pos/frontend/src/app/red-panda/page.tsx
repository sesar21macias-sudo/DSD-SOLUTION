'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { ShoppingBag, Plus, Minus, X, CheckCircle2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
const pub = axios.create({ baseURL: API_BASE })
const SLUG = 'red-panda'

const RED = '#E8152A'
const BLACK = '#111111'
const WHITE = '#F5F5F5'
const LIME = '#B5E030'
const BLUE = '#4040CC'
const PINK = '#E030A0'

interface Category { id: string; name: string; sort_order: number }
interface Product { id: string; name: string; description?: string; price_mxn: number; category_id: string; image_url?: string }
interface Tenant { id: string; name: string; slug: string; currency: string; logo_url?: string; slogan?: string }
interface CartItem { product_id: string; name: string; price: number; quantity: number; photo?: string }

// Foto exacta por nombre de producto — con un menu fijo esto da mejor resultado
// que emparejar por una sola palabra clave (dos "Pollo" de categorias distintas
// terminaban con la misma foto). Cada entrada viene de un fotografo distinto
// para que ademas se vean realmente diferentes entre si.
const EXACT_PHOTOS: Record<string, string> = {
  'yakisoba pollo':          'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&w=500&q=80',
  'yakisoba res':            'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&w=500&q=80',
  'yakisoba costilla':       'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&w=500&q=80',
  'yakisoba camaron':        'https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&w=500&q=80',
  'yakisoba sin proteina':   'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&w=500&q=80',
  'yakimeshi pollo':         'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&w=500&q=80',
  'yakimeshi res':           'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&w=500&q=80',
  'yakimeshi costilla':      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&w=500&q=80',
  'yakimeshi camaron':       'https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?auto=format&w=500&q=80',
  'yakimeshi yakiwings':     'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&w=500&q=80',
  'yakimeshi sin proteina':  'https://images.unsplash.com/photo-1512152272829-e3139592d56f?auto=format&w=500&q=80',
  'orange bowl':             'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?auto=format&w=500&q=80',
  'teriyaki pollo':          'https://images.unsplash.com/photo-1580217593608-61931cefc821?auto=format&w=500&q=80',
  'teriyaki res':            'https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?auto=format&w=500&q=80',
  'teriyaki costilla':       'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&w=500&q=80',
  'teriyaki camaron':        'https://images.unsplash.com/photo-1625944230945-1b7dd3b949ab?auto=format&w=500&q=80',
  'teriyaki sin proteina':   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&w=500&q=80',
  'chicken thai bowl':       'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&w=500&q=80',
  'california':              'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&w=500&q=80',
  'caterpillar':             'https://images.unsplash.com/photo-1617196034183-421b4917c92d?auto=format&w=500&q=80',
  'philly roll':             'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&w=500&q=80',
  'kamikaze':                'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?auto=format&w=500&q=80',
  'bombazo':                 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&w=500&q=80',
  'ninja ball pollo':        'https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&w=500&q=80',
  'ninja ball res':          'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&w=500&q=80',
  'ninja ball camaron':      'https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&w=500&q=80',
  'gyozas':                  'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&w=500&q=80',
  'rollos primavera (3pz)':  'https://images.unsplash.com/photo-1569058242252-623df46b5025?auto=format&w=500&q=80',
  'rollos primavera (c/u)':  'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&w=500&q=80',
  'agua embotellada ciel':   'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&w=500&q=80',
  'refresco lata':           'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&w=500&q=80',
}
const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&w=500&q=80',
  'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?auto=format&w=500&q=80',
  'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&w=500&q=80',
  'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&w=500&q=80',
  'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&w=500&q=80',
]
function photoFor(p: { id: string; name: string; image_url?: string }): string {
  if (p.image_url) return p.image_url
  const exact = EXACT_PHOTOS[p.name.toLowerCase().trim()]
  if (exact) return exact
  // Producto nuevo sin match exacto: hash deterministico del id para variar
  // sin depender del orden de la categoria.
  let hash = 0
  for (const ch of p.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK_PHOTOS[hash % FALLBACK_PHOTOS.length]
}

export default function RedPandaOrderPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [showLoyalty, setShowLoyalty] = useState(false)
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout'>('takeout')
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
  const [payingCard, setPayingCard] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [bump, setBump] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'counter'>('counter')
  const [ticketItems, setTicketItems] = useState<CartItem[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['pub-menu', SLUG],
    queryFn: async () => {
      const { data } = await pub.get(`/public/menu/${SLUG}`)
      return data.data as { tenant: Tenant; categories: Category[]; products: Product[] }
    },
  })

  const cartIdsKey = cart.map(i => i.product_id).sort().join(',')
  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', SLUG, cartIdsKey],
    queryFn: async () => {
      const { data } = await pub.get(`/public/recommendations/${SLUG}`, { params: { cart: cartIdsKey } })
      return data.data as Product[]
    },
    enabled: showCart && cart.length > 0,
  })

  const placeOrder = useMutation({
    mutationFn: async () => {
      const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
      const { data } = await pub.post(`/public/online-order/${SLUG}`, {
        customer_name: customerName.trim() || 'Cliente', order_type: orderType, items,
        notes: orderNotes.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        // Ambos metodos requieren cobro antes de llegar a cocina: tarjeta se
        // cobra ahora mismo via Mercado Pago, caja se cobra cuando el cajero
        // presiona "Cobrar" con el ticket en mano.
        require_payment: true,
      })
      return data.data
    },
    onSuccess: async (res) => {
      const num = res.order_number ?? res.order_id?.slice(0, 6).toUpperCase() ?? ''
      setOrderNumber(num)
      setPlacedOrderId(res.order_id)
      setTicketItems(cart)
      setCart([]); setShowCart(false); setOrderNotes('')

      if (paymentMethod === 'card') {
        // Pago con tarjeta: la orden ya se creo (la cocina la necesita ya),
        // pero al cliente lo mandamos derecho a pagar, sin pasar por el ticket.
        setPayingCard(true)
        try {
          const { data } = await pub.post(`/mp/preference/${SLUG}`, { order_id: res.order_id, tip_percent: 0 })
          window.location.href = data.data.init_point
          return
        } catch {
          setPayingCard(false)
          alert('No se pudo iniciar el pago con tarjeta. Se muestra tu ticket para pagar en caja.')
        }
      }
      setShowSuccess(true)
    },
    onError: () => alert('No se pudo enviar la orden. Intenta de nuevo.'),
  })

  function addToCart(p: Product, photo: string) {
    setCart(c => {
      const existing = c.find(i => i.product_id === p.id)
      if (existing) return c.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...c, { product_id: p.id, name: p.name, price: p.price_mxn, quantity: 1, photo }]
    })
    setToast(`${p.name} agregado`)
    window.setTimeout(() => setToast(null), 1600)
    setBump(true)
    window.setTimeout(() => setBump(false), 280)
  }
  function updateQty(id: string, qty: number) {
    setCart(c => qty <= 0 ? c.filter(i => i.product_id !== id) : c.map(i => i.product_id === id ? { ...i, quantity: qty } : i))
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)
  const tenant = data?.tenant
  const products = data?.products ?? []
  const categories = data?.categories ?? []
  const featured = products.slice(0, 3)
  const heroBowls = products.slice(0, 4)

  if (isLoading) return <div style={{ minHeight: '100vh', background: BLACK, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE }}>Cargando...</div>

  if (showSuccess) {
    const ticketTotal = ticketItems.reduce((s, i) => s + i.price * i.quantity, 0)
    return (
      <div style={{ minHeight: '100vh', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&family=DM+Sans:wght@500;700&display=swap');`}</style>
        <div style={{ background: WHITE, borderRadius: 4, maxWidth: 340, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
          <div style={{ background: RED, padding: '22px 20px', textAlign: 'center' }}>
            <CheckCircle2 size={32} color={WHITE} style={{ marginBottom: 6 }} />
            <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 26, color: WHITE, textTransform: 'uppercase' }}>Muestra este ticket en caja</h1>
            <p style={{ color: 'rgba(245,245,245,0.85)', fontSize: 12, marginTop: 4 }}>Para que confirmen tu pedido y pagues ahi</p>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px dashed #ddd' }}>
            <div style={{ background: WHITE, padding: 10, border: '1px solid #eee', borderRadius: 6 }}>
              <QRCodeSVG value={JSON.stringify({ order: orderNumber, id: placedOrderId, total: ticketTotal })} size={140} level="M" />
            </div>
            <p className="rp-display" style={{ fontSize: 20, color: BLACK, marginTop: 10 }}>#{orderNumber}</p>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {ticketItems.map(item => (
              <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#333' }}>
                <span>{item.quantity}× {item.name}</span>
                <span style={{ fontWeight: 700 }}>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTop: '1px solid #eee', fontWeight: 800, fontSize: 16 }}>
              <span>Total a pagar</span><span style={{ color: RED }}>${ticketTotal.toFixed(2)}</span>
            </div>
            {customerPhone.trim() && (
              <p style={{ marginTop: 10, fontSize: 12, color: LIME, background: '#111', display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
                +{Math.floor(ticketTotal / 10)} puntos al pagar
              </p>
            )}
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            <button onClick={() => { setShowSuccess(false); setPlacedOrderId(null); setTicketItems([]) }}
              style={{ width: '100%', background: BLACK, color: WHITE, border: 'none', padding: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', borderRadius: 3 }}>
              Hacer otro pedido
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: WHITE, minHeight: '100vh', fontFamily: "'DM Sans',sans-serif", color: BLACK, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        .rp-display{font-family:'Barlow Condensed',sans-serif;font-weight:900;text-transform:uppercase;line-height:0.9}
        @keyframes rp-scroll-left{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .rp-ticker-track{display:inline-flex;align-items:center;animation:rp-scroll-left 22s linear infinite;white-space:nowrap}
        @keyframes rp-float{0%,100%{transform:translateY(-14px)}50%{transform:translateY(-22px)}}
        @keyframes rp-float-r{0%,100%{transform:translateY(14px)}50%{transform:translateY(22px)}}
        .rp-bowl:nth-child(odd){animation:rp-float 4s ease-in-out infinite;transition:transform .3s ease,filter .3s ease}
        .rp-bowl:nth-child(even){animation:rp-float-r 4.4s ease-in-out infinite;transition:transform .3s ease,filter .3s ease}
        .rp-bowl:hover{filter:brightness(1.1) saturate(1.15);transform:scale(1.04) !important}
        .rp-card{position:relative;border-radius:3px;overflow:hidden;background:${BLACK};cursor:pointer;transition:transform .3s}
        .rp-card:hover{transform:scale(1.02)}
        .rp-card:hover img{transform:scale(1.08)}
        .rp-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .45s ease}
        .rp-cta{transition:filter .15s,transform .15s}
        @keyframes rp-bump{0%{transform:scale(1)}40%{transform:scale(1.15)}100%{transform:scale(1)}}
        .rp-bump{animation:rp-bump .28s ease}
        .rp-cta:hover{filter:brightness(1.15)}
        .rp-cta:active{transform:scale(0.96)}
        .rp-icon-btn{transition:filter .15s,transform .15s}
        .rp-icon-btn:hover{filter:brightness(1.2)}
        .rp-icon-btn:active{transform:scale(0.88)}
        .rp-product-card{transition:border-color .2s,transform .2s,box-shadow .2s;border:1px solid transparent}
        .rp-product-card:hover{border-color:${RED};transform:translateY(-3px);box-shadow:0 12px 28px rgba(232,21,42,0.22)}
        .rp-hero{position:relative}
        .rp-hero-spot{position:absolute;inset:0;pointer-events:none;background:radial-gradient(420px circle at var(--mx,50%) var(--my,30%), rgba(255,255,255,0.16), transparent 60%)}
        @keyframes rp-toast-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
        .rp-toast{animation:rp-toast-in .22s cubic-bezier(.22,1,.36,1)}
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: BLACK, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div className="rp-display" style={{ fontSize: 26, color: WHITE, display: 'flex', alignItems: 'center', gap: 8 }}>
          {tenant?.logo_url && <img src={tenant.logo_url} alt="" style={{ height: 38, width: 38, borderRadius: '50%', objectFit: 'cover', background: WHITE }} />}
          RED<span style={{ color: RED }}>P</span>ANDA
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowLoyalty(true)} style={{ background: 'transparent', color: LIME, border: `1px solid ${LIME}`, padding: '10px 14px', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 3 }}>
            Mis puntos
          </button>
          <button onClick={() => setShowCart(true)} className={`rp-cta${bump ? ' rp-bump' : ''}`} style={{ background: RED, color: WHITE, border: 'none', padding: '10px 20px', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={15} /> {totalItems > 0 ? `Carrito (${totalItems})` : 'Ordenar'}
          </button>
        </div>
      </nav>

      {showLoyalty && <LoyaltyModal onClose={() => setShowLoyalty(false)} />}

      {toast && (
        <div className="rp-toast" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 70, background: BLACK, color: WHITE, padding: '12px 22px', borderRadius: 3, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          <CheckCircle2 size={15} color={LIME} /> {toast}
        </div>
      )}

      <section className="rp-hero"
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
          e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
        }}
        style={{ background: RED, minHeight: '80vh', display: 'grid', gridTemplateColumns: heroBowls.length ? '1.1fr 0.9fr' : '1fr', position: 'relative', overflow: 'hidden' }}>
        <div className="rp-hero-spot" />
        {heroBowls.length > 0 && (
          <div style={{ padding: '48px 24px 96px 32px', display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 440 }}>
              {heroBowls.map((p, i) => (
                <div key={p.id} className="rp-bowl" style={{ aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', border: `4px solid rgba(245,245,245,0.25)` }}>
                  <img src={photoFor(p)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 32px 96px 24px', position: 'relative', zIndex: 1 }}>
          {tenant?.logo_url && <img src={tenant.logo_url} alt="" style={{ width: 110, height: 110, objectFit: 'contain', marginBottom: 12, borderRadius: 12 }} />}
          <h1 className="rp-display" style={{ fontSize: 'clamp(3.5rem,9vw,7rem)', color: BLACK }}>RED<br />PANDA</h1>
          <p style={{ color: 'rgba(245,245,245,0.9)', fontSize: 17, marginTop: 18, maxWidth: 300, fontWeight: 500 }}>
            {tenant?.slogan || 'Sabores autenticos de China. Rapido, fresco y sin compromiso.'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
            <div style={{ height: 8, width: 60, background: LIME }} />
            <div style={{ height: 8, width: 60, background: BLUE }} />
            <div style={{ height: 8, width: 60, background: PINK }} />
          </div>
          <button onClick={() => document.getElementById('rp-menu')?.scrollIntoView({ behavior: 'smooth' })} className="rp-cta"
            style={{ marginTop: 32, background: BLACK, color: WHITE, border: 'none', padding: '14px 28px', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', width: 'fit-content' }}>
            Ver Menu
          </button>
        </div>
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, lineHeight: 0 }}>
          <svg viewBox="0 0 1440 72" preserveAspectRatio="none" style={{ width: '100%', display: 'block' }}>
            <path d="M0,72 C280,18 560,62 840,36 C1060,14 1260,58 1440,28 L1440,72 Z" fill={WHITE} />
          </svg>
        </div>
      </section>

      {categories.length > 0 && (
        <div style={{ background: BLACK, padding: '14px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div className="rp-ticker-track">
            {[...categories, ...categories, ...categories].map((c, i) => (
              <span key={i} className="rp-display" style={{ fontSize: 18, color: WHITE, marginRight: 40, letterSpacing: '0.08em' }}>
                {c.name} <span style={{ color: [RED, LIME, PINK, BLUE][i % 4] }}>+</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <section id="rp-menu" style={{ padding: '72px 24px', background: WHITE }}>
        <h2 className="rp-display" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', color: BLACK, marginBottom: 40 }}>Los<br />Favoritos</h2>

        {featured.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gridTemplateRows: '260px 260px', gap: 14, marginBottom: 56 }}>
            {featured.map((p, i) => (
              <div key={p.id} onClick={() => addToCart(p, photoFor(p))} className="rp-card" style={{ gridRow: i === 0 ? 'span 2' : undefined, boxShadow: i === 0 ? '0 20px 40px rgba(0,0,0,0.35)' : undefined }}>
                <img src={photoFor(p)} alt={p.name} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(17,17,17,0.88) 0%, rgba(17,17,17,0) 55%)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 20px' }}>
                  <div className="rp-display" style={{ fontSize: i === 0 ? 24 : 19, color: WHITE }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(245,245,245,0.6)', marginTop: 4 }}>${p.price_mxn} MXN</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {categories.map(cat => {
          const items = products.filter(p => p.category_id === cat.id)
          if (!items.length) return null
          return (
            <div key={cat.id} style={{ marginBottom: 48 }}>
              <h3 className="rp-display" style={{ fontSize: 28, color: BLACK, marginBottom: 18 }}>{cat.name}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {items.map((p, i) => (
                  <div key={p.id} className="rp-product-card" style={{ background: BLACK, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: 140, overflow: 'hidden' }}>
                      <img src={photoFor(p)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <div className="rp-display" style={{ color: WHITE, fontSize: 16, letterSpacing: '0.01em' }}>{p.name}</div>
                      {p.description && <div style={{ color: 'rgba(245,245,245,0.5)', fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                        <span className="rp-display" style={{ color: LIME, fontSize: 20 }}>${p.price_mxn}</span>
                        <button onClick={() => addToCart(p, photoFor(p))} className="rp-icon-btn"
                          aria-label={`Agregar ${p.name} al carrito`}
                          style={{ background: RED, border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: WHITE }}>
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <section style={{ background: RED, padding: '80px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="rp-display" style={{ position: 'absolute', fontSize: '20vw', color: 'rgba(17,17,17,0.08)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>ORDER</div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="rp-display" style={{ fontSize: 'clamp(2.75rem,7vw,5.5rem)', color: WHITE, marginBottom: 16 }}>Listo Para<br />Ordenar?</h2>
          <button onClick={() => setShowCart(true)} className="rp-cta" style={{ background: BLACK, color: WHITE, border: 'none', padding: '16px 36px', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Ordenar Ahora
          </button>
        </div>
      </section>

      <footer style={{ background: '#0a0a0a', padding: '32px 24px', textAlign: 'center', color: 'rgba(245,245,245,0.4)', fontSize: 12 }}>
        © 2026 {tenant?.name ?? 'Red Panda'}. Pedidos conectados al POS en tiempo real.
      </footer>

      {showCart && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowCart(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 420, background: WHITE, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid #eee` }}>
              <h2 className="rp-display" style={{ fontSize: 22, color: BLACK }}>Tu Orden</h2>
              <button onClick={() => setShowCart(false)} className="rp-icon-btn" style={{ background: '#f2f2f2', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {cart.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: 60 }}>
                  <ShoppingBag size={32} color="#ccc" style={{ marginBottom: 10 }} />
                  <p style={{ color: '#999', fontSize: 14 }}>Tu carrito esta vacio</p>
                </div>
              )}
              {cart.map(item => (
                <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  {item.photo && <img src={item.photo} alt="" style={{ width: 52, height: 52, borderRadius: 3, objectFit: 'cover' }} />}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</p>
                    <p style={{ fontSize: 13, color: '#666' }}>${item.price} c/u &middot; ${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="rp-icon-btn" style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #ddd', background: WHITE, cursor: 'pointer' }}><Minus size={12} /></button>
                  <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="rp-icon-btn" style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #ddd', background: WHITE, cursor: 'pointer' }}><Plus size={12} /></button>
                </div>
              ))}

              {cart.length > 0 && recommendations && recommendations.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px dashed #ddd' }}>
                  <p className="rp-display" style={{ fontSize: 13, color: '#999', marginBottom: 10 }}>Tambien te puede gustar</p>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {recommendations.map((p) => (
                      <div key={p.id} onClick={() => addToCart(p, photoFor(p))} style={{ flexShrink: 0, width: 100, cursor: 'pointer' }}>
                        <div style={{ width: 100, height: 72, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                          <img src={photoFor(p)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>{p.name}</p>
                        <p style={{ fontSize: 11, color: RED, fontWeight: 700 }}>+${p.price_mxn}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: 20, borderTop: '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['takeout', 'dine_in'] as const).map(t => (
                    <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: '10px 8px', borderRadius: 3, cursor: 'pointer', border: `2px solid ${orderType === t ? RED : '#eee'}`, background: orderType === t ? 'rgba(232,21,42,0.06)' : WHITE, color: orderType === t ? RED : '#666', fontWeight: 600, fontSize: 13 }}>
                      {t === 'takeout' ? 'Para llevar' : 'En mesa'}
                    </button>
                  ))}
                </div>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Tu nombre"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 3, border: '1px solid #ddd', marginBottom: 10, fontSize: 14 }} />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Tu telefono (para ganar puntos)" type="tel"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 3, border: '1px solid #ddd', marginBottom: 10, fontSize: 14 }} />
                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Notas (alergias, sin cebolla, etc.)" rows={2}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 3, border: '1px solid #ddd', marginBottom: 12, fontSize: 13, fontFamily: 'inherit', resize: 'none' }} />

                <p className="rp-display" style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>Como vas a pagar?</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {([['card', 'Tarjeta ahora'], ['counter', 'Pagar en caja']] as const).map(([m, label]) => (
                    <button key={m} onClick={() => setPaymentMethod(m)} style={{ flex: 1, padding: '10px 8px', borderRadius: 3, cursor: 'pointer', border: `2px solid ${paymentMethod === m ? RED : '#eee'}`, background: paymentMethod === m ? 'rgba(232,21,42,0.06)' : WHITE, color: paymentMethod === m ? RED : '#666', fontWeight: 600, fontSize: 13 }}>
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginBottom: 14, borderTop: '1px dashed #ddd', fontWeight: 700, fontSize: 17 }}>
                  <span className="rp-display" style={{ fontSize: 15 }}>Total</span><span style={{ color: RED }}>${total.toFixed(2)}</span>
                </div>
                <button onClick={() => placeOrder.mutate()} disabled={placeOrder.isPending} className="rp-cta"
                  style={{ width: '100%', background: RED, color: WHITE, border: 'none', padding: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: placeOrder.isPending ? 'default' : 'pointer', opacity: placeOrder.isPending ? 0.7 : 1 }}>
                  {placeOrder.isPending ? 'Enviando...' : paymentMethod === 'card' ? 'Continuar a pago' : 'Confirmar orden'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Consulta simple de puntos: solo con el telefono, sin contraseña — la
// friccion cero es lo que hace que la gente realmente lo use en un negocio
// chico. El saldo real y las recompensas viven en el backend (loyalty_customers/
// loyalty_rewards), esto solo es la ventana para verlo.
interface LoyaltyReward { id: string; name: string; description?: string; points_required: number }
interface LoyaltyCustomer { full_name: string | null; points: number; total_visits: number; tier: string }

function LoyaltyModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(null)
  const [justRegistered, setJustRegistered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: rewards } = useQuery({
    queryKey: ['public-rewards', SLUG],
    queryFn: async () => { const { data } = await pub.get(`/public/loyalty/rewards/${SLUG}`); return data.data as LoyaltyReward[] },
  })

  async function checkPoints() {
    if (phone.trim().length < 7) { setError('Escribe un telefono valido'); return }
    setLoading(true); setError('')
    try {
      // Este mismo endpoint registra al cliente si es la primera vez que
      // pone su telefono — no hace falta un "boton de registro" aparte.
      const { data } = await pub.post(`/public/loyalty/identify/${SLUG}`, { phone: phone.trim(), name: name.trim() || undefined })
      setCustomer(data.data.customer)
      setJustRegistered(!!data.data.is_new)
    } catch {
      setError('No se pudo consultar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: WHITE, borderRadius: 6, maxWidth: 360, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="rp-display" style={{ fontSize: 22, color: BLACK }}>Mis Puntos</h2>
          <button onClick={onClose} style={{ background: '#f2f2f2', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer' }}><X size={14} /></button>
        </div>

        {!customer ? (
          <>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Escribe tu telefono para ver tus puntos, o registrate si es tu primera vez. Ganas 1 punto por cada $10 que gastas.</p>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre (si es tu primera vez)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 3, border: '1px solid #ddd', marginBottom: 8, fontSize: 14 }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Tu telefono" type="tel"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 3, border: '1px solid #ddd', marginBottom: 8, fontSize: 14 }} />
            {error && <p style={{ color: RED, fontSize: 12, marginBottom: 8 }}>{error}</p>}
            <button onClick={checkPoints} disabled={loading} className="rp-cta"
              style={{ width: '100%', background: BLACK, color: WHITE, border: 'none', padding: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Consultando...' : 'Ver mis puntos'}
            </button>
          </>
        ) : (
          <>
            {justRegistered && (
              <p style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
                🎉 Listo, ya estas registrado. Empieza a ganar puntos en tu proximo pedido.
              </p>
            )}
            <div style={{ background: BLACK, borderRadius: 6, padding: '18px 20px', textAlign: 'center', marginBottom: 16 }}>
              <p style={{ color: '#aaa', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{customer.full_name || 'Cliente'} &middot; nivel {customer.tier}</p>
              <p className="rp-display" style={{ color: LIME, fontSize: 40, marginTop: 4 }}>{customer.points}</p>
              <p style={{ color: '#aaa', fontSize: 11 }}>puntos disponibles</p>
            </div>

            <p className="rp-display" style={{ fontSize: 13, color: '#999', marginBottom: 10 }}>Recompensas</p>
            {(rewards ?? []).length === 0 && <p style={{ fontSize: 12, color: '#999' }}>Aun no hay recompensas configuradas.</p>}
            {(rewards ?? []).map(r => {
              const unlocked = customer.points >= r.points_required
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee', opacity: unlocked ? 1 : 0.5 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</p>
                    {r.description && <p style={{ fontSize: 11, color: '#999' }}>{r.description}</p>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: unlocked ? '#16a34a' : '#999', whiteSpace: 'nowrap', marginLeft: 10 }}>
                    {unlocked ? '✓ Disponible' : `${r.points_required} pts`}
                  </span>
                </div>
              )
            })}
            <button onClick={() => setCustomer(null)} style={{ marginTop: 16, width: '100%', background: 'transparent', color: '#999', border: 'none', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
              Consultar otro telefono
            </button>
          </>
        )}
      </div>
    </div>
  )
}
