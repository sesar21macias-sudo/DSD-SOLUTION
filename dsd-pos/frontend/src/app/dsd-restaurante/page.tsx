'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import {
  ShoppingCart, Plus, Minus, Trash2, X,
  ChevronRight, Star, Clock, MapPin, Phone, Flame,
} from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

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

const STRIPE_PK = 'pk_test_51TpZEEFxupxbJS8buDU9aoTjIcGLpvYc55eROC3BnaJAiipEyaklQKXaOnJTrjGrzK5RetJoA0wSiIi7Y8mKYAqi00tE0dCmhU'
const stripePromise = loadStripe(STRIPE_PK)

// ── Stripe checkout form ──────────────────────────────────────────────────────
function StripeCheckoutForm({ orderId, orderNumber, total, onSuccess, onBack }: {
  orderId: string; orderNumber: string; total: number
  onSuccess: (orderNumber: string) => void
  onBack: () => void
}) {
  const stripe   = useStripe()
  const elements = useElements()
  const [paying,   setPaying]   = useState(false)
  const [errMsg,   setErrMsg]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setPaying(true); setErrMsg(null)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    if (error) {
      setErrMsg(error.message ?? 'Error al procesar el pago')
      setPaying(false); return
    }
    if (paymentIntent?.status === 'succeeded') {
      try {
        await axios.post(`${API}/stripe/confirm`, { payment_intent_id: paymentIntent.id, order_id: orderId })
        onSuccess(orderNumber)
      } catch {
        setErrMsg('Pago recibido pero error al confirmar. Contacta al restaurante.')
      }
    }
    setPaying(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {errMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#dc2626' }}>
          {errMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || paying}
        style={{
          width: '100%', background: paying ? '#6b7280' : '#635bff',
          color: '#fff', fontWeight: 800, fontSize: 16,
          padding: '17px 0', borderRadius: 16, border: 'none',
          cursor: paying ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          transition: 'background .15s',
        }}
      >
        {paying ? 'Procesando...' : `Pagar $${total.toFixed(2)} MXN`}
      </button>
      <button
        type="button"
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
      >
        Volver a elegir metodo de pago
      </button>
    </form>
  )
}

interface PaymentData {
  preference_id: string
  order_id:      string
  order_number:  string
  total:         number
  public_key:    string
}

export default function DSDRestaurantePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart,        setCart]        = useState<CartItem[]>([])
  const [drawer,      setDrawer]      = useState(false)
  const [name,        setName]        = useState('')
  const [notes,       setNotes]       = useState('')
  const [tableId,     setTableId]     = useState<string>('')
  const [mpError,     setMpError]     = useState<string | null>(null)
  const [paymentData,      setPaymentData]      = useState<PaymentData | null>(null)
  const [paySuccess,       setPaySuccess]        = useState<string | null>(null)
  const [mpSdkReady,       setMpSdkReady]        = useState(false)
  const [payMethod,        setPayMethod]          = useState<'select' | 'mp' | 'stripe'>('select')
  const [stripeSecret,     setStripeSecret]       = useState<string | null>(null)
  const [stripeOrderId,    setStripeOrderId]      = useState<string | null>(null)
  const [stripeOrderNum,   setStripeOrderNum]     = useState<string>('')
  const [stripeTotal,      setStripeTotal]        = useState<number>(0)
  const [stripeLoading,    setStripeLoading]      = useState(false)
  const [stripeError,      setStripeError]        = useState<string | null>(null)
  const [countKey,    setCountKey]    = useState(0)
  const [filterAnim,  setFilterAnim]  = useState(false)
  const heroRef    = useRef<HTMLDivElement>(null)
  const gridRef    = useRef<HTMLDivElement>(null)
  const brickRef   = useRef<any>(null)

  // Inject global styles once
  useEffect(() => {
    if (document.getElementById('dsd-gs')) return
    const s = document.createElement('style')
    s.id = 'dsd-gs'; s.textContent = GLOBAL_STYLES
    document.head.appendChild(s)
  }, [])

  // Load Mercado Pago SDK once
  useEffect(() => {
    if ((window as any).MercadoPago) { setMpSdkReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = () => setMpSdkReady(true)
    document.head.appendChild(script)
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
      const { data: orderRes } = await pub.post(`/public/online-order/${TENANT_SLUG}`, {
        customer_name:   name || 'Cliente',
        notes:           notes || undefined,
        order_type:      tableId ? 'dine_in' : 'takeout',
        table_id:        tableId || undefined,
        require_payment: true,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
      })
      const orderData = orderRes.data as { order_id: string; order_number: string; total: number }

      const { data: mpRes } = await pub.post(`/mp/preference/${TENANT_SLUG}`, {
        order_id:    orderData.order_id,
        tip_percent: 0,
      })
      const mpData = mpRes.data as { preference_id: string; init_point: string; public_key: string }

      return {
        preference_id: mpData.preference_id,
        order_id:      orderData.order_id,
        order_number:  orderData.order_number,
        total:         orderData.total,
        public_key:    mpData.public_key,
        init_point:    mpData.init_point,
      }
    },
    onSuccess: (d) => {
      setCart([]); setDrawer(false); setName(''); setNotes(''); setTableId('')
      if (mpSdkReady) {
        setPaymentData({
          preference_id: d.preference_id,
          order_id:      d.order_id,
          order_number:  d.order_number,
          total:         d.total,
          public_key:    d.public_key,
        })
      } else {
        // SDK not loaded yet — fall back to redirect
        window.location.href = d.init_point
      }
    },
    onError: (e: any) => {
      setMpError(e?.response?.data?.error ?? 'No se pudo conectar con Mercado Pago. Intenta de nuevo.')
      setDrawer(false)
    },
  })

  // Initialize Payment Brick when showing MP screen
  useEffect(() => {
    if (!paymentData || !mpSdkReady || payMethod !== 'mp') return
    const container = document.getElementById('dsd-payment-brick')
    if (!container) return

    // Destroy previous brick instance if exists
    if (brickRef.current) {
      brickRef.current.unmount?.()
      brickRef.current = null
    }

    const mp = new (window as any).MercadoPago(paymentData.public_key, { locale: 'es-MX' })

    mp.bricks().create('payment', 'dsd-payment-brick', {
      initialization: {
        amount:       paymentData.total,
        preferenceId: paymentData.preference_id,
      },
      customization: {
        paymentMethods: {
          wallet_purchase: 'all',  // Apple Pay / Google Pay / MP Wallet
          creditCard:      'all',
          debitCard:       'all',
        },
        visual: {
          hidePaymentButton:     false,
          hideFormTitle:         false,
          style: { theme: 'default' },
        },
      },
      callbacks: {
        onReady: () => {},
        onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
          if (selectedPaymentMethod === 'wallet_purchase') return  // MP handles redirect
          try {
            await pub.post(`/mp/process-card/${TENANT_SLUG}`, {
              order_id: paymentData.order_id,
              ...formData,
            })
            setPaySuccess(paymentData.order_number)
            setPaymentData(null)
          } catch (e: any) {
            throw new Error(e?.response?.data?.error ?? 'Error al procesar el pago')
          }
        },
        onError: (err: any) => {
          console.error('[MP Brick]', err)
        },
      },
    }).then((brick: any) => { brickRef.current = brick })

    return () => {
      brickRef.current?.unmount?.()
      brickRef.current = null
    }
  }, [paymentData, mpSdkReady, payMethod])

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

  // ── Stripe payment screen ───────────────────────────────────────────────────
  if (payMethod === 'stripe' && stripeSecret && stripeOrderId) return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background: DARK, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => setPayMethod('select')}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
        >
          <X size={18} />
        </button>
        <div>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Pagar con Stripe</p>
          <p style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Orden {stripeOrderNum} · ${stripeTotal.toFixed(2)} MXN</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <svg width="44" height="20" viewBox="0 0 60 25" fill="none"><text x="0" y="18" fontSize="18" fontWeight="700" fill="#635bff" fontFamily="sans-serif">stripe</text></svg>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>
        <Elements stripe={stripePromise} options={{ clientSecret: stripeSecret, appearance: { theme: 'stripe' } }}>
          <StripeCheckoutForm
            orderId={stripeOrderId}
            orderNumber={stripeOrderNum}
            total={stripeTotal}
            onSuccess={(num) => { setPayMethod('select'); setStripeSecret(null); setPaySuccess(num) }}
            onBack={() => setPayMethod('select')}
          />
        </Elements>
      </div>
    </div>
  )

  // ── Payment method selector ──────────────────────────────────────────────────
  if (payMethod !== 'select' || (paymentData && payMethod === 'select')) {
    // show selector only when paymentData is set and method not chosen yet
  }
  if (paymentData && payMethod === 'select') return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: DARK, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => { setPaymentData(null); setPayMethod('select') }}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
        >
          <X size={18} />
        </button>
        <div>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Elige como pagar</p>
          <p style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Orden {paymentData.order_number} · ${paymentData.total.toFixed(2)} MXN</p>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px', width: '100%' }}>
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 24 }}>Selecciona tu metodo de pago preferido</p>

        {/* Stripe */}
        <button
          onClick={async () => {
            setStripeLoading(true); setStripeError(null)
            try {
              const { data } = await pub.post('/stripe/payment-intent', { order_id: paymentData.order_id })
              setStripeSecret(data.data.client_secret)
              setStripeOrderId(paymentData.order_id)
              setStripeOrderNum(paymentData.order_number)
              setStripeTotal(paymentData.total)
              setPayMethod('stripe')
            } catch (e: any) {
              setStripeError(e?.response?.data?.error ?? 'Error al conectar con Stripe')
            }
            setStripeLoading(false)
          }}
          disabled={stripeLoading}
          style={{
            width: '100%', background: '#fff', border: '2px solid #635bff',
            borderRadius: 20, padding: '20px 24px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
            transition: 'box-shadow .15s', boxShadow: '0 2px 12px rgba(99,91,255,.1)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,91,255,.2)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,91,255,.1)')}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#635bff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#fff"/></svg>
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 4 }}>
              {stripeLoading ? 'Conectando...' : 'Apple Pay / Google Pay / Tarjeta'}
            </p>
            <p style={{ fontSize: 12, color: '#6b7280' }}>Powered by Stripe · Pago inmediato</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <span style={{ background: '#000', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}> Pay</span>
            <span style={{ background: '#fff', border: '1px solid #e5e7eb', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, color: '#555' }}>G Pay</span>
          </div>
        </button>

        {/* Mercado Pago */}
        <button
          onClick={() => setPayMethod('mp')}
          style={{
            width: '100%', background: '#fff', border: '2px solid #009ee3',
            borderRadius: 20, padding: '20px 24px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
            transition: 'box-shadow .15s', boxShadow: '0 2px 12px rgba(0,158,227,.08)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,158,227,.18)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,158,227,.08)')}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#009ee3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 4 }}>Mercado Pago</p>
            <p style={{ fontSize: 12, color: '#6b7280' }}>Tarjeta, OXXO, cartera MP</p>
          </div>
        </button>

        {stripeError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#dc2626', marginTop: 8 }}>
            {stripeError}
          </div>
        )}
      </div>
    </div>
  )

  // ── Payment Brick screen (MP) ────────────────────────────────────────────────
  if (paymentData && payMethod === 'mp') return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: DARK, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => setPayMethod('select')}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}
        >
          <X size={18} />
        </button>
        <div>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Completa tu pago</p>
          <p style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Orden {paymentData.order_number} · ${paymentData.total.toFixed(2)} MXN</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Apple Pay icon */}
          <svg width="36" height="22" viewBox="0 0 36 22" fill="none"><rect width="36" height="22" rx="4" fill="#fff"/><text x="5" y="15" fontSize="9" fontWeight="700" fill="#000" fontFamily="system-ui"></text><text x="4" y="15" fontSize="8" fill="#000" fontFamily="-apple-system,sans-serif" fontWeight="600"> Pay</text></svg>
          {/* Google Pay icon */}
          <svg width="44" height="22" viewBox="0 0 44 22" fill="none"><rect width="44" height="22" rx="4" fill="#fff"/><text x="4" y="15" fontSize="8" fill="#4285F4" fontFamily="sans-serif" fontWeight="700">G</text><text x="12" y="15" fontSize="8" fill="#555" fontFamily="sans-serif">Pay</text></svg>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 20 }}>
          Elige tu metodo de pago preferido
        </p>
        {/* MP Payment Brick renders here */}
        <div id="dsd-payment-brick" />
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#f5f6fa', borderTop: '1px solid #e5e7eb', padding: '12px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#009ee3"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          Pago seguro con Mercado Pago · SSL cifrado
        </p>
      </div>
    </div>
  )

  // ── Pay success screen ───────────────────────────────────────────────────────
  if (paySuccess) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#fff', border: '3px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 8px 32px rgba(22,163,74,.2)' }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, color: DARK, letterSpacing: '-0.03em', marginBottom: 10 }}>Pago exitoso</h1>
        <p style={{ fontSize: 16, color: '#374151', lineHeight: 1.6, marginBottom: 28 }}>Tu pedido ya esta en camino a la cocina.</p>
        <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 20, padding: '24px 28px', marginBottom: 28, boxShadow: '0 4px 20px rgba(0,166,80,.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Orden</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: DARK, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{paySuccess}</p>
          <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>Tiempo estimado: 15-20 min</p>
        </div>
        <button
          onClick={() => setPaySuccess(null)}
          style={{ width: '100%', background: DARK, color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', borderRadius: 18, border: 'none', cursor: 'pointer' }}
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )

  // ── MP error screen ──────────────────────────────────────────────────────────
  if (mpError) return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fef2f2', border: '2px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <span style={{ fontSize: 36 }}>!</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1917', marginBottom: 10 }}>Error al procesar pago</h1>
        <p style={{ color: '#78716c', fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>{mpError}</p>
        <button
          onClick={() => setMpError(null)}
          style={{ width: '100%', background: DARK, color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', borderRadius: 18, border: 'none', cursor: 'pointer' }}
        >
          Intentar de nuevo
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
                      Pagaras con Mercado Pago antes de que llegue a cocina
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
                {placeOrder.isPending
                  ? 'Preparando pago...'
                  : <><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{flexShrink:0}}><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg> Pagar con Mercado Pago</>
                }
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#a8a29e', marginTop: 12 }}>
                Pago seguro · Tu pedido llega a cocina despues del pago
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
