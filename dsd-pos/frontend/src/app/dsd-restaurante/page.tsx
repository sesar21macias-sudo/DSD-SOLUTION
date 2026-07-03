'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import {
  ShoppingCart, Plus, Minus, Trash2, X,
  CheckCircle, ChevronRight, Star, Clock, MapPin, Phone, Flame,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

const pub = axios.create({ baseURL: API })
const TENANT_SLUG = 'tacos-el-guero'

interface Category { id: string; name: string; sort_order: number }
interface Product  { id: string; name: string; description?: string; price_mxn: number; category_id: string }
interface CartItem { id: string; name: string; price: number; qty: number }
interface Table    { id: string; name: string; status: string }

// ── Exact product-name → Unsplash photo map ──────────────────────────────────
const PRODUCT_PHOTOS: Record<string, string> = {
  'Taco de Birria':      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
  'Taco de Asada':       'https://images.unsplash.com/photo-1611250188496-e966043a0629?w=600&q=80',
  'Taco de Pastor':      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
  'Taco de Carnitas':    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&q=80',
  'Taco de Suadero':     'https://images.unsplash.com/photo-1611250188496-e966043a0629?w=600&q=80',
  'Quesadilla Sencilla': 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&q=80',
  'Quesadilla Asada':    'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&q=80',
  'Agua Fresca':         'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80',
  'Refresco':            'https://images.unsplash.com/photo-1527960669566-f882ba1a5a1e?w=600&q=80',
  'Agua Mineral':        'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&q=80',
  'Churros':             'https://images.unsplash.com/photo-1583338917451-face2751d8d5?w=600&q=80',
  'Consomé':             'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80',
  'Salsa Verde':         'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80',
  'Orden de Tortillas':  'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80',
}

// Keyword fallback for products not in the exact map
const KEYWORD_PHOTOS: [string, string][] = [
  ['birria',     'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'],
  ['asada',      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80'],
  ['pastor',     'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=600&q=80'],
  ['carnitas',   'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'],
  ['taco',       'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'],
  ['quesadilla', 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&q=80'],
  ['agua',       'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80'],
  ['refresco',   'https://images.unsplash.com/photo-1527960669566-f882ba1a5a1e?w=600&q=80'],
  ['churro',     'https://images.unsplash.com/photo-1624953701887-e10a879c1e1d?w=600&q=80'],
  ['salsa',      'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80'],
  ['tortilla',   'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80'],
  ['consomé',    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
]
const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80'

function photoFor(name: string): string {
  if (PRODUCT_PHOTOS[name]) return PRODUCT_PHOTOS[name]
  const n = name.toLowerCase()
  for (const [kw, url] of KEYWORD_PHOTOS) {
    if (n.includes(kw)) return url
  }
  return FALLBACK_PHOTO
}

// ── Palette ───────────────────────────────────────────────────────────────────
const ACCENT = '#e8421a'
const DARK   = '#111111'
const CREAM  = '#faf9f7'

// ── Global styles injected once ───────────────────────────────────────────────
const GLOBAL_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0 }

  @keyframes slideUp   { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes bounceIn  { 0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(.92)}
                         60%{transform:translateX(-50%) translateY(-5px) scale(1.02)}
                         100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
  @keyframes drawerIn  { from{transform:translateX(100%)} to{transform:translateX(0)} }
  @keyframes checkPop  { 0%{transform:scale(0);opacity:0} 65%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
  @keyframes countPop  { 0%{transform:scale(1)} 35%{transform:scale(1.5)} 100%{transform:scale(1)} }
  @keyframes shimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes ripple    { from{transform:scale(0);opacity:.4} to{transform:scale(3.5);opacity:0} }
  @keyframes pillsIn   { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spinBadge { 0%{transform:rotate(-8deg) scale(.8)} 60%{transform:rotate(4deg) scale(1.06)} 100%{transform:rotate(0) scale(1)} }
  @keyframes cardReveal{ from{opacity:0;transform:translateY(28px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

  .hero-badge  { animation: spinBadge .5s cubic-bezier(.34,1.56,.64,1) both .05s }
  .hero-h1     { animation: slideUp   .7s cubic-bezier(.22,1,.36,1) both .18s }
  .hero-p      { animation: slideUp   .7s cubic-bezier(.22,1,.36,1) both .32s }
  .hero-ctas   { animation: slideUp   .7s cubic-bezier(.22,1,.36,1) both .46s }
  .hero-info   { animation: fadeIn    .7s ease both .65s }
  .hero-mosaic { animation: fadeIn    .9s ease both .25s }
  .pill-in     { animation: bounceIn  .42s cubic-bezier(.22,1,.36,1) both }
  .drawer-in   { animation: drawerIn  .35s cubic-bezier(.22,1,.36,1) both }
  .check-anim  { animation: checkPop  .55s cubic-bezier(.34,1.56,.64,1) both .1s }
  .count-pop   { animation: countPop  .32s cubic-bezier(.34,1.56,.64,1) }

  .card-hidden { opacity:0; transform:translateY(28px) scale(.97) }
  .card-visible{ animation: cardReveal .48s cubic-bezier(.22,1,.36,1) both }

  .cat-pill    { animation: pillsIn .3s ease both }

  .add-btn { position:relative; overflow:hidden }
  .add-btn .ripple-el { position:absolute; border-radius:50%; background:rgba(255,255,255,0.4); pointer-events:none;
    animation:ripple .55s ease-out forwards }

  .product-card img { transition: transform .45s cubic-bezier(.22,1,.36,1) }
  .product-card:hover img { transform: scale(1.07) }

  .skeleton { background: linear-gradient(90deg,#f0ece8 25%,#e8e4e0 50%,#f0ece8 75%);
    background-size:400px 100%; animation:shimmer 1.2s infinite }

  ::-webkit-scrollbar { width:5px; height:5px }
  ::-webkit-scrollbar-track { background:transparent }
  ::-webkit-scrollbar-thumb { background:#d6d3d1; border-radius:99px }
`

// ── Ripple helper ─────────────────────────────────────────────────────────────
function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget
  const r = btn.getBoundingClientRect()
  const size = Math.max(r.width, r.height) * 1.4
  const x = e.clientX - r.left - size / 2
  const y = e.clientY - r.top  - size / 2
  const el = document.createElement('span')
  el.className = 'ripple-el'
  el.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`
  btn.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

export default function DSDRestaurantePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart,      setCart]      = useState<CartItem[]>([])
  const [drawer,    setDrawer]    = useState(false)
  const [name,      setName]      = useState('')
  const [notes,     setNotes]     = useState('')
  const [tableId,   setTableId]   = useState<string>('')
  const [success,   setSuccess]   = useState<string | null>(null)
  const [successTableId, setSuccessTableId] = useState<string | null>(null)
  const [countKey, setCountKey] = useState(0)
  const [filterAnim, setFilterAnim] = useState(false)
  const heroRef  = useRef<HTMLDivElement>(null)
  const gridRef  = useRef<HTMLDivElement>(null)

  // Inject global styles once
  useEffect(() => {
    if (document.getElementById('dsd-gs')) return
    const s = document.createElement('style')
    s.id = 'dsd-gs'; s.textContent = GLOBAL_STYLES
    document.head.appendChild(s)
  }, [])

  // Hero parallax
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const onScroll = () => {
      const y = window.scrollY
      hero.style.backgroundPositionY = `${y * 0.35}px`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // IntersectionObserver for card stagger
  const observeCards = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const cards = grid.querySelectorAll<HTMLElement>('.card-hidden')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          el.style.animationDelay = `${i * 60}ms`
          el.classList.remove('card-hidden')
          el.classList.add('card-visible')
          io.unobserve(el)
        }
      })
    }, { threshold: 0.06 })
    cards.forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['dsd-menu'],
    queryFn: async () => {
      const { data } = await pub.get(`/public/menu/${TENANT_SLUG}`)
      return data.data as {
        tenant: { name: string; currency: string }
        categories: Category[]
        products: Product[]
      }
    },
  })

  const { data: tables } = useQuery({
    queryKey: ['dsd-tables'],
    queryFn: async () => {
      const { data } = await pub.get(`/public/tables/${TENANT_SLUG}`)
      return data.data as Table[]
    },
  })

  // Re-observe after data or filter change
  useEffect(() => {
    const t = setTimeout(() => observeCards(), 60)
    return () => clearTimeout(t)
  }, [data, activeCategory, observeCards])

  const placeOrder = useMutation({
    mutationFn: async () => {
      const { data } = await pub.post(`/public/online-order/${TENANT_SLUG}`, {
        customer_name: name || 'Cliente Web',
        notes:         notes || undefined,
        order_type:    tableId ? 'dine_in' : 'takeout',
        table_id:      tableId || undefined,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
      })
      return data.data as { order_number: string; total: number }
    },
    onSuccess: (d) => {
      setSuccess(d.order_number)
      setSuccessTableId(tableId || null)
      setCart([])
      setDrawer(false)
      setName('')
      setNotes('')
      setTableId('')
    },
  })

  // Smooth category switch
  function switchCategory(id: string | null) {
    setFilterAnim(true)
    setTimeout(() => {
      setActiveCategory(id)
      setFilterAnim(false)
    }, 160)
  }

  const filtered = (data?.products ?? []).filter(
    p => !activeCategory || p.category_id === activeCategory
  )

  function addToCart(p: Product, e: React.MouseEvent<HTMLButtonElement>) {
    addRipple(e)
    setCart(c => {
      const ex = c.find(i => i.id === p.id)
      return ex
        ? c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
        : [...c, { id: p.id, name: p.name, price: p.price_mxn, qty: 1 }]
    })
    setCountKey(k => k + 1)
  }

  function setQty(id: string, qty: number) {
    setCart(c => qty <= 0 ? c.filter(i => i.id !== id) : c.map(i => i.id === id ? { ...i, qty } : i))
  }

  const totalItems = cart.reduce((s, i) => s + i.qty, 0)
  const subtotal   = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax        = subtotal * 0.16
  const total      = subtotal + tax

  // Lock scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawer])

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div className="check-anim" style={{ width: 96, height: 96, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
          <CheckCircle size={48} color="#16a34a" strokeWidth={1.8} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1c1917', letterSpacing: '-0.03em', marginBottom: 10 }}>Pedido enviado</h1>
        <p style={{ color: '#78716c', fontSize: 16, lineHeight: 1.6, marginBottom: 36 }}>
          Tu pedido esta en cocina. Pasa a recogerlo en unos minutos.
        </p>
        <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 28, padding: '32px 28px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#a8a29e', textTransform: 'uppercase', marginBottom: 10 }}>
            Numero de orden
          </p>
          <p style={{ fontSize: 42, fontWeight: 900, color: DARK, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
            {success}
          </p>
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#78716c', fontSize: 14 }}>
            <Clock size={14} /> Tiempo estimado: 15-20 min
          </div>
        </div>
        {successTableId && (
          <a
            href={`/pagar/${TENANT_SLUG}/${successTableId}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: '#009ee3', color: '#fff', fontWeight: 800, fontSize: 16, padding: '16px 0', borderRadius: 18, border: 'none', cursor: 'pointer', textDecoration: 'none', marginBottom: 12 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
            Pagar con Mercado Pago
          </a>
        )}
        <button
          onClick={() => { setSuccess(null); setSuccessTableId(null) }}
          style={{ width: '100%', background: DARK, color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', borderRadius: 18, border: 'none', cursor: 'pointer', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = ACCENT)}
          onMouseLeave={e => (e.currentTarget.style.background = DARK)}
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div style={{ background: CREAM, minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,249,247,0.88)', backdropFilter: 'blur(18px) saturate(1.4)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        padding: '0 28px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, fontStyle: 'italic' }}>D</span>
          </div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 16, color: '#1c1917', letterSpacing: '-0.02em', lineHeight: 1.1 }}>DSD Restaurante</p>
            <p style={{ fontSize: 10, color: '#a8a29e', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ordena en linea</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ fontSize: 14, fontWeight: 600, color: '#78716c', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 10, transition: 'color .15s, background .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0efed'; e.currentTarget.style.color = '#1c1917' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#78716c' }}
          >
            Menu
          </button>
          <button
            className="add-btn"
            onClick={e => { addRipple(e); setDrawer(true) }}
            style={{ background: DARK, color: '#fff', border: 'none', borderRadius: 14, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = ACCENT)}
            onMouseLeave={e => (e.currentTarget.style.background = DARK)}
          >
            <ShoppingCart size={16} />
            Carrito
            {totalItems > 0 && (
              <span key={countKey} className="count-pop"
                style={{ background: ACCENT, borderRadius: 99, minWidth: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        style={{
          background: 'linear-gradient(135deg,#1a0600 0%,#1c1208 45%,#111111 100%)',
          padding: '88px 28px 96px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Glows */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 65% 60% at 70% 40%, rgba(232,66,26,.13) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -120, left: '10%', width: 380, height: 380, background: 'radial-gradient(circle, rgba(249,115,22,.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto', gap: 60, alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(232,66,26,.15)', border: '1px solid rgba(232,66,26,.3)', borderRadius: 99, padding: '6px 16px', marginBottom: 30 }}>
              <Flame size={13} fill={ACCENT} color={ACCENT} />
              <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>Ordena en linea, listo en 15 min</span>
            </div>
            <h1 className="hero-h1" style={{ fontSize: 'clamp(44px,6.5vw,82px)', fontWeight: 900, color: '#faf9f7', lineHeight: 1.02, letterSpacing: '-0.038em', marginBottom: 20 }}>
              Sabor autentico,<br />
              <span style={{ color: ACCENT }}>entregado</span> a ti
            </h1>
            <p className="hero-p" style={{ fontSize: 17, color: '#a8a29e', lineHeight: 1.7, maxWidth: 500, marginBottom: 38 }}>
              Tacos, quesadillas y mas. Todo preparado al momento con ingredientes frescos. Sin conservadores, sin compromisos.
            </p>
            <div className="hero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="add-btn"
                onClick={e => { addRipple(e); document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' }) }}
                style={{ background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 34px', borderRadius: 16, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity .15s, transform .15s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '.87'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = '' }}
              >
                Ordenar ahora <ChevronRight size={17} />
              </button>
              <button
                style={{ background: 'rgba(255,255,255,.07)', color: '#e7e5e4', fontWeight: 600, fontSize: 16, padding: '16px 30px', borderRadius: 16, border: '1px solid rgba(255,255,255,.12)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                onClick={() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' })}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.28)'; e.currentTarget.style.background = 'rgba(255,255,255,.11)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; e.currentTarget.style.background = 'rgba(255,255,255,.07)' }}
              >
                Ver el menu
              </button>
            </div>
          </div>

          {/* Mosaic */}
          <div className="hero-mosaic" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: 310, flexShrink: 0 }}>
            {([
              { name: 'Taco de Birria',    borderRadius: '22px 4px 22px 4px', mt: '0' },
              { name: 'Taco de Pastor',   borderRadius: '4px 22px 4px 22px', mt: '-12px' },
              { name: 'Agua Fresca',      borderRadius: '4px 22px 4px 22px', mt: '12px' },
              { name: 'Quesadilla Sencilla', borderRadius: '22px 4px 22px 4px', mt: '0' },
            ] as { name: string; borderRadius: string; mt: string }[]).map((item, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: item.borderRadius, overflow: 'hidden', marginTop: item.mt, transition: 'transform .3s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                <img
                  src={photoFor(item.name)}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .82 }}
                  onError={e => { e.currentTarget.src = FALLBACK_PHOTO }}
                  loading="eager"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Info strip */}
        <div className="hero-info" style={{ maxWidth: 1060, margin: '52px auto 0', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {[
            { icon: <MapPin size={13} />,  text: 'Av. Reforma 245, Col. Centro' },
            { icon: <Clock size={13} />,   text: 'Lun-Dom  8am - 10pm' },
            { icon: <Phone size={13} />,   text: '(55) 1234-5678' },
            { icon: <Star size={13} fill="#e8421a" color="#e8421a" />, text: '4.9 de 5 en resenas' },
          ].map(({ icon, text }) => (
            <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#57534e', fontSize: 13, fontWeight: 500 }}>
              {icon}{text}
            </span>
          ))}
        </div>
      </section>

      {/* ── Menu ── */}
      <section id="menu-section" style={{ maxWidth: 1060, margin: '0 auto', padding: '64px 24px 112px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 38, fontWeight: 900, color: '#1c1917', letterSpacing: '-0.028em', marginBottom: 6 }}>Nuestro menu</h2>
          <p style={{ color: '#78716c', fontSize: 15 }}>Preparado al momento, con ingredientes frescos</p>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 38, scrollbarWidth: 'none' }}>
          {[{ id: null, name: 'Todo' }, ...(data?.categories ?? [])].map((cat, i) => {
            const active = activeCategory === cat.id
            return (
              <button
                key={cat.id ?? 'all'}
                className="cat-pill add-btn"
                style={{
                  animationDelay: `${i * 55}ms`,
                  flexShrink: 0, padding: '10px 24px', borderRadius: 99,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  border: active ? 'none' : '1px solid #e7e5e4',
                  background: active ? DARK : '#fff',
                  color: active ? '#fff' : '#44403c',
                  transition: 'all .2s',
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                }}
                onClick={e => { addRipple(e); switchCategory(cat.id) }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f0efed'; e.currentTarget.style.borderColor = '#d6d3d1' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e7e5e4' } }}
              >
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* Skeleton while loading */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 18 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ borderRadius: 22, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
                <div className="skeleton" style={{ height: 190 }} />
                <div style={{ padding: '16px 18px 20px' }}>
                  <div className="skeleton" style={{ height: 18, borderRadius: 8, marginBottom: 10, width: '65%' }} />
                  <div className="skeleton" style={{ height: 13, borderRadius: 6, marginBottom: 18, width: '80%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="skeleton" style={{ height: 24, borderRadius: 8, width: 60 }} />
                    <div className="skeleton" style={{ height: 38, width: 38, borderRadius: '50%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product grid */}
        {!isLoading && (
          <div
            ref={gridRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
              gap: 18,
              opacity: filterAnim ? 0 : 1,
              transform: filterAnim ? 'translateY(8px)' : 'translateY(0)',
              transition: 'opacity .16s, transform .16s',
            }}
          >
            {filtered.map(p => {
              const inCart = cart.find(i => i.id === p.id)
              return (
                <div
                  key={p.id}
                  className="product-card card-hidden"
                  style={{
                    background: '#fff', borderRadius: 22, overflow: 'hidden',
                    border: '1px solid #ede8e3',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                    transition: 'box-shadow .25s, transform .25s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 14px 40px rgba(0,0,0,0.12)'
                    e.currentTarget.style.transform = 'translateY(-5px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)'
                    e.currentTarget.style.transform = ''
                  }}
                >
                  {/* Photo */}
                  <div style={{ height: 196, overflow: 'hidden', position: 'relative', background: '#f0ece8' }}>
                    <img
                      src={photoFor(p.name)}
                      alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.currentTarget.src = FALLBACK_PHOTO }}
                      loading="lazy"
                    />
                    {inCart && (
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(17,17,17,.82)', backdropFilter: 'blur(6px)', color: '#fff', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                        {inCart.qty} en carrito
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '16px 18px 20px' }}>
                    <h3 style={{ fontWeight: 800, fontSize: 16, color: '#1c1917', marginBottom: p.description ? 6 : 14, letterSpacing: '-0.01em' }}>
                      {p.name}
                    </h3>
                    {p.description && (
                      <p style={{ fontSize: 13, color: '#78716c', lineHeight: 1.5, marginBottom: 14 }}>
                        {p.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 900, fontSize: 24, color: '#1c1917', letterSpacing: '-0.02em' }}>
                        ${p.price_mxn}
                      </span>
                      {inCart ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button
                            className="add-btn"
                            onClick={e => { addRipple(e); setQty(p.id, inCart.qty - 1) }}
                            style={{ width: 34, height: 34, borderRadius: '50%', background: '#f0efed', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44403c', transition: 'background .15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#e5e1dd')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#f0efed')}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ fontWeight: 900, minWidth: 24, textAlign: 'center', color: '#1c1917', fontSize: 16 }}>
                            {inCart.qty}
                          </span>
                          <button
                            className="add-btn"
                            onClick={e => addToCart(p, e)}
                            style={{ width: 34, height: 34, borderRadius: '50%', background: DARK, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'background .15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = ACCENT)}
                            onMouseLeave={e => (e.currentTarget.style.background = DARK)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-btn"
                          onClick={e => addToCart(p, e)}
                          style={{ width: 42, height: 42, borderRadius: '50%', background: DARK, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'background .15s, transform .18s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.transform = 'scale(1.13) rotate(5deg)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = DARK;  e.currentTarget.style.transform = '' }}
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Floating pill ── */}
      {totalItems > 0 && !drawer && (
        <button
          className="pill-in add-btn"
          onClick={e => { addRipple(e); setDrawer(true) }}
          style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: DARK, color: '#fff', border: 'none', borderRadius: 99,
            padding: '15px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer', zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 18,
            boxShadow: '0 10px 44px rgba(0,0,0,.32), 0 2px 8px rgba(0,0,0,.16)',
            whiteSpace: 'nowrap', transition: 'background .15s, transform .2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.transform = 'translateX(-50%) scale(1.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = DARK;   e.currentTarget.style.transform = 'translateX(-50%) scale(1)' }}
        >
          <span style={{ background: ACCENT, borderRadius: 99, padding: '3px 12px', fontSize: 13, fontWeight: 900 }}>
            {totalItems}
          </span>
          Ver mi pedido
          <span style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>${total.toFixed(2)}</span>
        </button>
      )}

      {/* ── Cart drawer ── */}
      {drawer && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawer(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.48)', backdropFilter: 'blur(5px)', zIndex: 200 }}
          />
          {/* Panel */}
          <div
            className="drawer-in"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460,
              background: CREAM, zIndex: 201, display: 'flex', flexDirection: 'column',
              boxShadow: '-28px 0 80px rgba(0,0,0,.2)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '22px 26px', borderBottom: '1px solid #e7e5e4', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 22, color: '#1c1917', letterSpacing: '-0.025em' }}>Mi pedido</h2>
                <p style={{ fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
                  {totalItems} producto{totalItems !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                className="add-btn"
                onClick={e => { addRipple(e); setDrawer(false) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: '#f0efed', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78716c', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e5e1dd')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f0efed')}
              >
                <X size={17} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Tu nombre
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Carlos Mendez"
                  style={{ width: '100%', background: '#fff', border: '1.5px solid #e7e5e4', borderRadius: 14, padding: '13px 16px', fontSize: 14, color: '#1c1917', outline: 'none', transition: 'border-color .15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = DARK)}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e7e5e4')}
                />
              </div>

              {/* Mesa (opcional) */}
              {tables && tables.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Mesa <span style={{ color: '#d6d3d1', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <select
                    value={tableId}
                    onChange={e => setTableId(e.target.value)}
                    style={{ width: '100%', background: '#fff', border: '1.5px solid #e7e5e4', borderRadius: 14, padding: '13px 16px', fontSize: 14, color: tableId ? '#1c1917' : '#a8a29e', outline: 'none', cursor: 'pointer', appearance: 'none' }}
                  >
                    <option value=''>Para llevar</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {tableId && (
                    <p style={{ marginTop: 6, fontSize: 12, color: '#009ee3', fontWeight: 600 }}>
                      Al confirmar podras pagar desde tu telefono con Mercado Pago
                    </p>
                  )}
                </div>
              )}

              {/* Items */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Productos
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', border: '1px solid #ede8e3', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#1c1917', marginBottom: 3 }}>{item.name}</p>
                        <p style={{ fontSize: 13, color: '#78716c', fontWeight: 600 }}>${(item.price * item.qty).toFixed(2)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => setQty(item.id, item.qty - 1)}
                          style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0efed', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44403c', transition: 'background .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#e5e1dd')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#f0efed')}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{ fontWeight: 900, minWidth: 22, textAlign: 'center', color: '#1c1917', fontSize: 15 }}>
                          {item.qty}
                        </span>
                        <button
                          onClick={() => setQty(item.id, item.qty + 1)}
                          style={{ width: 32, height: 32, borderRadius: '50%', background: DARK, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'background .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = ACCENT)}
                          onMouseLeave={e => (e.currentTarget.style.background = DARK)}
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          onClick={() => setQty(item.id, 0)}
                          style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d6d3d1', transition: 'color .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#d6d3d1')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Alergias, sin picante, instrucciones especiales..."
                  rows={2}
                  style={{ width: '100%', background: '#fff', border: '1.5px solid #e7e5e4', borderRadius: 14, padding: '13px 16px', fontSize: 14, color: '#1c1917', outline: 'none', resize: 'none', fontFamily: 'inherit', transition: 'border-color .15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = DARK)}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e7e5e4')}
                />
              </div>

              {/* Totals */}
              <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', border: '1px solid #ede8e3' }}>
                {[['Subtotal', `$${subtotal.toFixed(2)}`], ['IVA (16%)', `$${tax.toFixed(2)}`]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#78716c', marginBottom: 12 }}>
                    <span>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 22, color: '#1c1917', paddingTop: 14, borderTop: '1px solid #f0efed', letterSpacing: '-0.025em' }}>
                  <span>Total</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '18px 26px', borderTop: '1px solid #e7e5e4', background: '#fff' }}>
              <button
                className="add-btn"
                onClick={e => { addRipple(e); placeOrder.mutate() }}
                disabled={cart.length === 0 || placeOrder.isPending}
                style={{
                  width: '100%', background: placeOrder.isPending ? '#44403c' : DARK, color: '#fff',
                  border: 'none', borderRadius: 18, padding: '18px 0', fontWeight: 800, fontSize: 16,
                  cursor: placeOrder.isPending ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  opacity: cart.length === 0 ? 0.42 : 1,
                  transition: 'background .15s, opacity .15s',
                }}
                onMouseEnter={e => { if (!placeOrder.isPending && cart.length > 0) e.currentTarget.style.background = ACCENT }}
                onMouseLeave={e => { if (!placeOrder.isPending) e.currentTarget.style.background = DARK }}
              >
                {placeOrder.isPending ? 'Enviando...' : 'Enviar pedido a cocina'}
                {!placeOrder.isPending && <ChevronRight size={19} />}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#a8a29e', marginTop: 12 }}>
                Pago en tienda al recoger tu pedido
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Footer ── */}
      <footer style={{ background: DARK, padding: '40px 28px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#1f1f1f', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, fontStyle: 'italic' }}>D</span>
          </div>
          <span style={{ color: '#57534e', fontWeight: 700, fontSize: 15 }}>DSD Restaurante</span>
        </div>
        <p style={{ color: '#3d3937', fontSize: 12 }}>Powered by DSD AI Solutions &copy; 2025</p>
      </footer>
    </div>
  )
}
