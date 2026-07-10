'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { ShoppingCart, Plus, Minus, Trash2, X, ChevronRight, Star, Clock, MapPin, Phone, Gift, User, LogOut } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const API               = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
const pub               = axios.create({ baseURL: API })
const TENANT_SLUG       = 'tacos-el-guero'
const STORAGE_KEY       = `dsd_ct_${TENANT_SLUG}`
const GOOGLE_CLIENT_ID  = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

// ── Palette (black / white / grey — red only for key CTAs) ───────────────────
const BG       = '#0d0d0d'
const SURFACE  = '#161616'
const SURFACE2 = '#1e1e1e'
const BORDER   = '#262626'
const TEXT     = '#f0f0f0'
const TEXT2    = '#888888'
const TEXT3    = '#444444'
const ACCENT   = '#e8421a'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; sort_order: number }
interface Product  { id: string; name: string; description?: string; price_mxn: number; category_id: string }
interface CartItem { id: string; name: string; price: number; qty: number }
interface Table    { id: string; name: string; status: string }
interface Reward   { id: string; name: string; description?: string; points_required: number; reward_type: 'discount' | 'free_item' | 'percentage'; reward_value?: number }
interface Customer { id: string; full_name: string | null; points: number; total_visits: number; tier: string }

// ── Product photos ────────────────────────────────────────────────────────────
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
const KEYWORD_PHOTOS: [string, string][] = [
  ['birria',      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'],
  ['asada',       'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80'],
  ['pastor',      'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=600&q=80'],
  ['carnitas',    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'],
  ['suadero',     'https://images.unsplash.com/photo-1611250188496-e966043a0629?w=600&q=80'],
  ['tripa',       'https://images.unsplash.com/photo-1583338917451-face2751d8d5?w=600&q=80'],
  ['lengua',      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'],
  ['chorizo',     'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80'],
  ['cochinita',   'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'],
  ['mulita',      'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&q=80'],
  ['vampiro',     'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&q=80'],
  ['guisado',     'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['taco',        'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'],
  ['quesadilla',  'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&q=80'],
  ['gordita',     'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&q=80'],
  ['tamal',       'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['enchilada',   'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'],
  ['burrito',     'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=600&q=80'],
  ['torta',       'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80'],
  ['guacamole',   'https://images.unsplash.com/photo-1548940740-204726a19be3?w=600&q=80'],
  ['nopal',       'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['frijol',      'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['arroz',       'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['agua',        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80'],
  ['limonada',    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80'],
  ['horchata',    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80'],
  ['jamaica',     'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80'],
  ['refresco',    'https://images.unsplash.com/photo-1527960669566-f882ba1a5a1e?w=600&q=80'],
  ['soda',        'https://images.unsplash.com/photo-1527960669566-f882ba1a5a1e?w=600&q=80'],
  ['bebida',      'https://images.unsplash.com/photo-1527960669566-f882ba1a5a1e?w=600&q=80'],
  ['jugo',        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80'],
  ['cerveza',     'https://images.unsplash.com/photo-1527960669566-f882ba1a5a1e?w=600&q=80'],
  ['churro',      'https://images.unsplash.com/photo-1624953701887-e10a879c1e1d?w=600&q=80'],
  ['postre',      'https://images.unsplash.com/photo-1583338917451-face2751d8d5?w=600&q=80'],
  ['dulce',       'https://images.unsplash.com/photo-1583338917451-face2751d8d5?w=600&q=80'],
  ['salsa',       'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80'],
  ['tortilla',    'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80'],
  ['consomé',     'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['consome',     'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['caldo',       'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'],
  ['orden',       'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'],
]
const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80'

function photoFor(name: string): string {
  if (PRODUCT_PHOTOS[name]) return PRODUCT_PHOTOS[name]
  const n = name.toLowerCase()
  for (const [kw, url] of KEYWORD_PHOTOS) { if (n.includes(kw)) return url }
  return FALLBACK_PHOTO
}

function calcDiscount(reward: Reward, subtotal: number): number {
  if (reward.reward_type === 'discount')   return Math.min(reward.reward_value ?? 0, subtotal * 1.16)
  if (reward.reward_type === 'percentage') return Math.min((subtotal * (reward.reward_value ?? 0)) / 100, subtotal * 1.16)
  return 0
}

// ── Google Sign-In button component ──────────────────────────────────────────
function GoogleSignInButton({ onCredential }: { onCredential: (r: { credential: string }) => void }) {
  const btnRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!btnRef.current || !(window as any).google?.accounts) return
    ;(window as any).google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback:  onCredential,
    })
    ;(window as any).google.accounts.id.renderButton(btnRef.current, {
      theme:          'filled_black',
      size:           'large',
      width:          btnRef.current.offsetWidth || 340,
      text:           'continue_with',
      locale:         'es',
      logo_alignment: 'left',
      shape:          'rectangular',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <div ref={btnRef} style={{ width: '100%', borderRadius: 16, overflow: 'hidden', minHeight: 48 }} />
}

// ── Global styles ─────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0 }

  @keyframes slideUp   { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
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
  @keyframes cardReveal{ from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes gateIn    { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gateSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pinPop    { 0%{transform:scale(0.6);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes profileIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

  .hero-h1     { animation: slideUp   .7s cubic-bezier(.22,1,.36,1) both .12s }
  .hero-p      { animation: slideUp   .7s cubic-bezier(.22,1,.36,1) both .26s }
  .hero-ctas   { animation: slideUp   .7s cubic-bezier(.22,1,.36,1) both .40s }
  .hero-info   { animation: fadeIn    .7s ease both .55s }
  .hero-mosaic { animation: fadeIn    .9s ease both .2s }
  .pill-in     { animation: bounceIn  .42s cubic-bezier(.22,1,.36,1) both }
  .drawer-in   { animation: drawerIn  .35s cubic-bezier(.22,1,.36,1) both }
  .profile-in  { animation: profileIn .35s cubic-bezier(.22,1,.36,1) both }
  .gate-card   { animation: gateIn    .52s cubic-bezier(.22,1,.36,1) both }
  .check-anim  { animation: checkPop  .55s cubic-bezier(.34,1.56,.64,1) both .1s }
  .count-pop   { animation: countPop  .32s cubic-bezier(.34,1.56,.64,1) }
  .cat-pill    { animation: pillsIn .3s ease both }
  .card-hidden { opacity:0; transform:translateY(24px) scale(.97) }
  .card-visible{ animation: cardReveal .48s cubic-bezier(.22,1,.36,1) both }
  .add-btn { position:relative; overflow:hidden }
  .add-btn .ripple-el { position:absolute;border-radius:50%;background:rgba(255,255,255,0.3);pointer-events:none;animation:ripple .55s ease-out forwards }
  .product-card img { transition: transform .45s cubic-bezier(.22,1,.36,1) }
  .product-card:hover img { transform: scale(1.07) }
  .skeleton { background:linear-gradient(90deg,#1a1a1a 25%,#242424 50%,#1a1a1a 75%);background-size:400px 100%;animation:shimmer 1.2s infinite }
  ::-webkit-scrollbar { width:4px;height:4px }
  ::-webkit-scrollbar-track { background:transparent }
  ::-webkit-scrollbar-thumb { background:#333;border-radius:99px }
  input:focus,textarea:focus,select:focus { outline:none }
`

function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget
  const r = btn.getBoundingClientRect()
  const size = Math.max(r.width, r.height) * 1.4
  const el = document.createElement('span')
  el.className = 'ripple-el'
  el.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`
  btn.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

// ── Stripe ────────────────────────────────────────────────────────────────────
const STRIPE_PK = 'pk_test_51TpZEEFxupxbJS8buDU9aoTjIcGLpvYc55eROC3BnaJAiipEyaklQKXaOnJTrjGrzK5RetJoA0wSiIi7Y8mKYAqi00tE0dCmhU'
const stripePromise = loadStripe(STRIPE_PK)

function StripeCheckoutForm({ orderId, orderNumber, total, onSuccess, onBack }: {
  orderId: string; orderNumber: string; total: number
  onSuccess: (orderNumber: string) => void
  onBack: () => void
}) {
  const stripe   = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setPaying(true); setErrMsg(null)
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) { setErrMsg(error.message ?? 'Error al procesar el pago'); setPaying(false); return }
    if (paymentIntent?.status === 'succeeded') {
      try {
        await axios.post(`${API}/stripe/confirm`, { payment_intent_id: paymentIntent.id, order_id: orderId })
        onSuccess(orderNumber)
      } catch { setErrMsg('Pago recibido pero error al confirmar. Contacta al restaurante.') }
    }
    setPaying(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {errMsg && <div style={{ background: '#1a0a0a', border: '1px solid #3d1515', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#f87171' }}>{errMsg}</div>}
      <button type="submit" disabled={!stripe || paying}
        style={{ width: '100%', background: paying ? TEXT3 : '#635bff', color: TEXT, fontWeight: 800, fontSize: 16, padding: '17px 0', borderRadius: 16, border: 'none', cursor: paying ? 'wait' : 'pointer', transition: 'background .15s' }}
      >
        {paying ? 'Procesando...' : `Pagar $${total.toFixed(2)} MXN`}
      </button>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: TEXT3, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
        Volver a elegir metodo de pago
      </button>
    </form>
  )
}

interface PaymentData { preference_id: string; order_id: string; order_number: string; total: number; public_key: string }

// ── Tier helpers ──────────────────────────────────────────────────────────────
const TIER_LABELS: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }
const TIER_COLORS: Record<string, string> = { bronze: '#cd7f32', silver: '#aaaaaa', gold: '#d4af37', platinum: '#e8e8e8' }

// ── Main component ────────────────────────────────────────────────────────────
export default function DSDRestaurantePage() {
  // Cart / ordering
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart,        setCart]        = useState<CartItem[]>([])
  const [drawer,      setDrawer]      = useState(false)
  const [name,        setName]        = useState('')
  const [notes,       setNotes]       = useState('')
  const [tableId,     setTableId]     = useState<string>('')
  const [mpError,      setMpError]      = useState<string | null>(null)
  const [paymentData,  setPaymentData]  = useState<PaymentData | null>(null)
  const [paySuccess,   setPaySuccess]   = useState<string | null>(null)
  const [paidAtCounter,setPaidAtCounter]= useState(false)
  const [payAtCounter, setPayAtCounter] = useState(false)
  const [mpSdkReady,   setMpSdkReady]  = useState(false)
  const [payMethod,   setPayMethod]   = useState<'select'|'mp'|'stripe'>('select')
  const [stripeSecret,   setStripeSecret]   = useState<string | null>(null)
  const [stripeOrderId,  setStripeOrderId]  = useState<string | null>(null)
  const [stripeOrderNum, setStripeOrderNum] = useState<string>('')
  const [stripeTotal,    setStripeTotal]    = useState<number>(0)
  const [stripeLoading,  setStripeLoading]  = useState(false)
  const [stripeError,    setStripeError]    = useState<string | null>(null)
  const [countKey,    setCountKey]    = useState(0)
  const [filterAnim,  setFilterAnim]  = useState(false)

  // Loyalty gate
  const [gateStep,     setGateStep]     = useState<'phone'|'loading'|'found'|'enter-pin'|'new'|'set-pin'|'done'>('phone')
  const [gatePhone,    setGatePhone]    = useState('')
  const [gateName,     setGateName]     = useState('')
  const [gatePin,      setGatePin]      = useState('')
  const [gatePinErr,   setGatePinErr]   = useState<string | null>(null)
  const [gateCustomer, setGateCustomer] = useState<Customer | null>(null)
  const [gateHasPin,   setGateHasPin]   = useState(false)
  const [gateError,    setGateError]    = useState<string | null>(null)

  // Logged-in customer session
  const [customerToken,  setCustomerToken]  = useState<string | null>(null)
  const [customer,       setCustomer]       = useState<Customer | null>(null)
  const [allRewards,     setAllRewards]     = useState<Reward[]>([])
  const [availRewards,   setAvailRewards]   = useState<Reward[]>([])
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [googleReady,    setGoogleReady]    = useState(false)

  const heroRef  = useRef<HTMLDivElement>(null)
  const brickRef = useRef<any>(null)

  // Inject global styles
  useEffect(() => {
    if (document.getElementById('dsd-gs')) return
    const s = document.createElement('style')
    s.id = 'dsd-gs'; s.textContent = GLOBAL_STYLES
    document.head.appendChild(s)
  }, [])

  // Load MP SDK
  useEffect(() => {
    if ((window as any).MercadoPago) { setMpSdkReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = () => setMpSdkReady(true)
    document.head.appendChild(script)
  }, [])

  // Load Google GSI
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    function initGSI() {
      ;(window as any).google?.accounts.id.initialize({
        client_id:   GOOGLE_CLIENT_ID,
        callback:    handleGoogleCredential,
        auto_select: false,
        context:     'signin',
      })
      setGoogleReady(true)
    }
    if ((window as any).google?.accounts) { initGSI(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = initGSI
    document.head.appendChild(s)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore saved customer session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    ;(async () => {
      try {
        const { data } = await pub.get(`/public/loyalty/profile/${TENANT_SLUG}`, { headers: { Authorization: `Bearer ${saved}` } })
        const d = data.data
        setCustomerToken(saved)
        setCustomer(d.customer)
        setAllRewards(d.all_rewards)
        setAvailRewards(d.available_rewards)
        setGateCustomer(d.customer)
        setGateStep('done')
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    })()
  }, [])

  // Hero parallax
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const onScroll = () => { hero.style.backgroundPositionY = `${window.scrollY * 0.35}px` }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])


  // ── Gate handlers ─────────────────────────────────────────────────────────
  async function handleGateSubmit() {
    if (gatePhone.length < 7) return
    setGateStep('loading'); setGateError(null)
    try {
      const { data } = await pub.post(`/public/loyalty/identify/${TENANT_SLUG}`, { phone: gatePhone })
      const d = data.data
      setGateCustomer(d.customer)
      setGateHasPin(d.has_pin)
      if (d.is_new) { setGateStep('new') }
      else if (d.has_pin) { setGateStep('enter-pin') }
      else { setGateStep('found') }
    } catch {
      setGateStep('phone')
      setGateError('No se pudo conectar. Intenta de nuevo.')
    }
  }

  async function handleGateRegister() {
    setGateStep('loading')
    try {
      const { data } = await pub.post(`/public/loyalty/identify/${TENANT_SLUG}`, { phone: gatePhone, name: gateName.trim() || undefined })
      setGateCustomer(data.data.customer)
      setGateStep('set-pin')
    } catch { setGateStep('new') }
  }

  async function handleSetPin() {
    if (gatePin.length !== 4) return
    setGatePinErr(null)
    setGateStep('loading')
    try {
      const { data } = await pub.post(`/public/loyalty/set-pin/${TENANT_SLUG}`, { phone: gatePhone, pin: gatePin })
      const token = data.data.token
      await saveSession(token)
      setGateStep('done')
    } catch { setGateStep('set-pin'); setGatePinErr('No se pudo guardar el PIN. Intenta de nuevo.') }
  }

  async function handleEnterPin() {
    if (gatePin.length !== 4) return
    setGatePinErr(null)
    setGateStep('loading')
    try {
      const { data } = await pub.post(`/public/loyalty/login/${TENANT_SLUG}`, { phone: gatePhone, pin: gatePin })
      const token = data.data.token
      await saveSession(token)
      setGateCustomer(data.data.customer)
      setGateStep('found')
    } catch (e: any) {
      setGateStep('enter-pin')
      setGatePinErr(e?.response?.data?.error ?? 'PIN incorrecto')
      setGatePin('')
    }
  }

  async function handleGoogleCredential(response: { credential: string }) {
    setGateStep('loading')
    try {
      const { data } = await pub.post(`/public/loyalty/google/${TENANT_SLUG}`, { credential: response.credential })
      const d = data.data
      setGateCustomer(d.customer)
      setGateHasPin(d.has_pin)
      await saveSession(d.token)
      if (d.has_pin || !d.is_new) {
        setGateStep('found')
      } else {
        setGateStep('set-pin')
      }
    } catch {
      setGateStep('phone')
      setGateError('Error al iniciar sesion con Google. Intenta de nuevo.')
    }
  }

  async function saveSession(token: string) {
    localStorage.setItem(STORAGE_KEY, token)
    setCustomerToken(token)
    try {
      const { data } = await pub.get(`/public/loyalty/profile/${TENANT_SLUG}`, { headers: { Authorization: `Bearer ${token}` } })
      setCustomer(data.data.customer)
      setAllRewards(data.data.all_rewards)
      setAvailRewards(data.data.available_rewards)
    } catch {}
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setCustomerToken(null)
    setCustomer(null)
    setAllRewards([])
    setAvailRewards([])
    setSelectedReward(null)
    setProfileOpen(false)
    setGateStep('phone')
    setGatePhone('')
    setGatePin('')
    setGateCustomer(null)
  }

  // MP Brick
  useEffect(() => {
    if (!paymentData || !mpSdkReady || payMethod !== 'mp') return
    const container = document.getElementById('dsd-payment-brick')
    if (!container) return
    if (brickRef.current) { brickRef.current.unmount?.(); brickRef.current = null }
    const mp = new (window as any).MercadoPago(paymentData.public_key, { locale: 'es-MX' })
    mp.bricks().create('payment', 'dsd-payment-brick', {
      initialization: { amount: paymentData.total, preferenceId: paymentData.preference_id },
      customization: {
        paymentMethods: { wallet_purchase: 'all', creditCard: 'all', debitCard: 'all' },
        visual: { hidePaymentButton: false, hideFormTitle: false, style: { theme: 'default' } },
      },
      callbacks: {
        onReady: () => {},
        onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
          if (selectedPaymentMethod === 'wallet_purchase') return
          try {
            await pub.post(`/mp/process-card/${TENANT_SLUG}`, { order_id: paymentData.order_id, ...formData })
            setPaySuccess(paymentData.order_number)
            setPaymentData(null)
          } catch (e: any) { throw new Error(e?.response?.data?.error ?? 'Error al procesar el pago') }
        },
        onError: (err: any) => { console.error('[MP Brick]', err) },
      },
    }).then((brick: any) => { brickRef.current = brick })
    return () => { brickRef.current?.unmount?.(); brickRef.current = null }
  }, [paymentData, mpSdkReady, payMethod])

  function switchCategory(id: string | null) {
    setFilterAnim(true)
    setTimeout(() => { setActiveCategory(id); setFilterAnim(false) }, 160)
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dsd-menu'],
    queryFn: async () => {
      const { data } = await pub.get(`/public/menu/${TENANT_SLUG}`)
      return data.data as { tenant: { name: string; currency: string }; categories: Category[]; products: Product[] }
    },
    retry: 2,
    retryDelay: 3000,
  })

  const { data: tables } = useQuery({
    queryKey: ['dsd-tables'],
    queryFn: async () => {
      const { data } = await pub.get(`/public/tables/${TENANT_SLUG}`)
      return data.data as Table[]
    },
  })

  const placeOrder = useMutation({
    mutationFn: async ({ atCounter }: { atCounter: boolean }) => {
      const { data: orderRes } = await pub.post(`/public/online-order/${TENANT_SLUG}`, {
        customer_name:   name || customer?.full_name || 'Cliente',
        customer_phone:  gatePhone || undefined,
        customer_token:  customerToken || undefined,
        reward_id:       selectedReward?.id || undefined,
        notes:           notes || undefined,
        order_type:      tableId ? 'dine_in' : 'takeout',
        table_id:        tableId || undefined,
        require_payment: !atCounter,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
      })
      const orderData = orderRes.data as { order_id: string; order_number: string; total: number; discount?: number }

      if (atCounter) return { atCounter: true, order_number: orderData.order_number, order_id: '', preference_id: '', total: orderData.total, public_key: '', init_point: '' }

      const { data: mpRes } = await pub.post(`/mp/preference/${TENANT_SLUG}`, { order_id: orderData.order_id, tip_percent: 0 })
      const mpData = mpRes.data as { preference_id: string; init_point: string; public_key: string }

      return {
        atCounter:     false,
        preference_id: mpData.preference_id,
        order_id:      orderData.order_id,
        order_number:  orderData.order_number,
        total:         orderData.total,
        public_key:    mpData.public_key,
        init_point:    mpData.init_point,
      }
    },
    onSuccess: (d) => {
      setCart([]); setDrawer(false); setName(''); setNotes(''); setTableId(''); setSelectedReward(null)
      if (d.atCounter) {
        setPaidAtCounter(true)
        setPaySuccess(d.order_number)
        return
      }
      setPaidAtCounter(false)
      if (mpSdkReady) {
        setPaymentData({ preference_id: d.preference_id, order_id: d.order_id, order_number: d.order_number, total: d.total, public_key: d.public_key })
      } else { window.location.href = d.init_point }
    },
    onError: (e: any) => {
      setMpError(e?.response?.data?.error ?? 'No se pudo conectar. Intenta de nuevo.')
      setDrawer(false)
    },
  })

  function addToCart(p: Product, e: React.MouseEvent<HTMLButtonElement>) {
    addRipple(e)
    setCart(c => {
      const ex = c.find(i => i.id === p.id)
      return ex ? c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { id: p.id, name: p.name, price: p.price_mxn, qty: 1 }]
    })
    setCountKey(k => k + 1)
  }

  function setQty(id: string, qty: number) {
    setCart(c => qty <= 0 ? c.filter(i => i.id !== id) : c.map(i => i.id === id ? { ...i, qty } : i))
  }

  const totalItems = cart.reduce((s, i) => s + i.qty, 0)
  const subtotal   = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax        = subtotal * 0.16
  const baseTotal  = subtotal + tax
  const discount   = selectedReward ? calcDiscount(selectedReward, subtotal) : 0
  const total      = Math.max(0, baseTotal - discount)
  const filtered   = (data?.products ?? []).filter(p => !activeCategory || p.category_id === activeCategory)

  useEffect(() => { document.body.style.overflow = (drawer || profileOpen) ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [drawer, profileOpen])

  // ── GATE SCREEN ───────────────────────────────────────────────────────────
  if (gateStep !== 'done') {
    const VISITS_PER_PRIZE = 8
    const cycleVisits = gateCustomer ? gateCustomer.total_visits % VISITS_PER_PRIZE : 0
    const progressPct = Math.round((cycleVisits / VISITS_PER_PRIZE) * 100)
    const toNextPrize = VISITS_PER_PRIZE - cycleVisits
    const firstName   = gateCustomer?.full_name?.split(' ')[0] ?? ''

    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 20px', fontFamily: 'system-ui,-apple-system,sans-serif', position: 'relative', overflow: 'hidden' }}>
        <style>{`* { box-sizing:border-box;margin:0;padding:0 } @keyframes gateIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}} @keyframes gateSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pinPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}} .gate-card{animation:gateIn .52s cubic-bezier(.22,1,.36,1) both}`}</style>

        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,240,240,.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="gate-card" style={{ width: '100%', maxWidth: 400 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: SURFACE, border: `1px solid ${BORDER}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: ACCENT, fontWeight: 900, fontSize: 24, fontStyle: 'italic' }}>D</span>
            </div>
          </div>

          {/* Phone */}
          {gateStep === 'phone' && (
            <>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: TEXT, textAlign: 'center', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 10 }}>Bienvenido</h1>
              <p style={{ color: TEXT2, fontSize: 14, textAlign: 'center', lineHeight: 1.65, marginBottom: 28 }}>Acumula puntos en cada visita y<br />canjealos por premios</p>

              {/* Google Sign-In */}
              {GOOGLE_CLIENT_ID && googleReady && (
                <>
                  <GoogleSignInButton onCredential={handleGoogleCredential} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                    <span style={{ fontSize: 12, color: TEXT3, fontWeight: 600, letterSpacing: '0.06em' }}>O CON TELEFONO</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                  </div>
                </>
              )}

              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: TEXT3, fontSize: 15, fontWeight: 700, userSelect: 'none' }}>+52</span>
                <div style={{ position: 'absolute', left: 54, top: '50%', transform: 'translateY(-50%)', width: 1, height: 20, background: BORDER }} />
                <input type="tel" inputMode="numeric" value={gatePhone} maxLength={10} autoFocus
                  onChange={e => setGatePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={e => e.key === 'Enter' && gatePhone.length >= 7 && handleGateSubmit()}
                  placeholder="Numero de telefono"
                  style={{ width: '100%', background: SURFACE, border: `1.5px solid ${gatePhone.length >= 7 ? TEXT3 : BORDER}`, borderRadius: 16, padding: '17px 18px 17px 70px', fontSize: 17, color: TEXT, letterSpacing: '0.06em', transition: 'border-color .2s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = TEXT2 }}
                  onBlur={e => { e.currentTarget.style.borderColor = gatePhone.length >= 7 ? TEXT3 : BORDER }}
                />
              </div>
              {gateError && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{gateError}</p>}
              <button onClick={handleGateSubmit} disabled={gatePhone.length < 7}
                style={{ width: '100%', background: gatePhone.length < 7 ? SURFACE : ACCENT, color: gatePhone.length < 7 ? TEXT3 : '#fff', border: 'none', borderRadius: 16, padding: '17px 0', fontWeight: 800, fontSize: 16, cursor: gatePhone.length < 7 ? 'not-allowed' : 'pointer', transition: 'background .2s', marginBottom: 14 }}>
                Continuar
              </button>
              <button onClick={() => setGateStep('done')} style={{ width: '100%', background: 'none', border: 'none', color: TEXT3, fontSize: 13, cursor: 'pointer', padding: '10px 0' }}
                onMouseEnter={e => (e.currentTarget.style.color = TEXT2)} onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}>
                Saltar por ahora
              </button>
            </>
          )}

          {/* Loading */}
          {gateStep === 'loading' && (
            <div style={{ textAlign: 'center', padding: '52px 0' }}>
              <div style={{ width: 40, height: 40, border: `3px solid ${SURFACE2}`, borderTop: `3px solid ${TEXT}`, borderRadius: '50%', animation: 'gateSpin .75s linear infinite', margin: '0 auto 20px' }} />
              <p style={{ color: TEXT2, fontSize: 14 }}>Un momento...</p>
            </div>
          )}

          {/* New customer — registration form */}
          {gateStep === 'new' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: SURFACE, border: `1px solid ${BORDER}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Star size={24} color={TEXT} fill={TEXT} />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: TEXT, letterSpacing: '-0.04em', marginBottom: 8 }}>Crea tu cuenta</h1>
                <p style={{ color: TEXT2, fontSize: 13, lineHeight: 1.65 }}>Gana puntos en cada visita y canjealos<br />por descuentos y premios.</p>
              </div>

              {/* Perks strip */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
                {[
                  { icon: '⭐', label: 'Puntos por compra' },
                  { icon: '🎁', label: 'Premios gratis' },
                  { icon: '💸', label: 'Descuentos' },
                ].map(p => (
                  <div key={p.label} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
                    <p style={{ fontSize: 10, color: TEXT2, fontWeight: 600, lineHeight: 1.3 }}>{p.label}</p>
                  </div>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Tu nombre</label>
              <input type="text" value={gateName} autoFocus onChange={e => setGateName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGateRegister()} placeholder="Nombre completo"
                style={{ width: '100%', background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: '15px 18px', fontSize: 16, color: TEXT, marginBottom: 10, transition: 'border-color .2s' }}
                onFocus={e => { e.currentTarget.style.borderColor = TEXT2 }} onBlur={e => { e.currentTarget.style.borderColor = BORDER }}
              />

              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Telefono</label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: TEXT3, fontSize: 14, fontWeight: 700 }}>+52</span>
                <div style={{ position: 'absolute', left: 50, top: '50%', transform: 'translateY(-50%)', width: 1, height: 18, background: BORDER }} />
                <input type="tel" inputMode="numeric" value={gatePhone} maxLength={10} readOnly
                  style={{ width: '100%', background: SURFACE2, border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: '15px 18px 15px 62px', fontSize: 16, color: TEXT2, letterSpacing: '0.06em' }}
                />
              </div>

              <button onClick={handleGateRegister} style={{ width: '100%', background: TEXT, color: BG, border: 'none', borderRadius: 16, padding: '17px 0', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
                Crear cuenta gratis
              </button>
              <button onClick={() => setGateStep('done')} style={{ width: '100%', background: 'none', border: 'none', color: TEXT3, fontSize: 13, cursor: 'pointer', padding: '10px 0' }}
                onMouseEnter={e => (e.currentTarget.style.color = TEXT2)} onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}>
                Saltar por ahora
              </button>
            </>
          )}

          {/* Set PIN */}
          {gateStep === 'set-pin' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: TEXT, letterSpacing: '-0.04em', marginBottom: 10 }}>Crea tu PIN</h1>
                <p style={{ color: TEXT2, fontSize: 14, lineHeight: 1.65 }}>Un PIN de 4 digitos para acceder a tus<br />puntos y recompensas en tu proxima visita</p>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ width: 52, height: 64, borderRadius: 14, background: SURFACE, border: `2px solid ${gatePin.length > i ? TEXT2 : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: TEXT, transition: 'border-color .2s', animation: gatePin.length === i + 1 ? 'pinPop .28s cubic-bezier(.34,1.56,.64,1)' : 'none' }}>
                    {gatePin.length > i ? '•' : ''}
                  </div>
                ))}
              </div>
              {/* Visible numeric PIN pad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
                  if (key === '') return <div key={i} />
                  const isBack = key === '⌫'
                  return (
                    <button key={i} type="button"
                      onClick={() => { if (isBack) setGatePin(p => p.slice(0, -1)); else if (gatePin.length < 4) setGatePin(p => p + key) }}
                      style={{ width: '100%', padding: '18px 0', borderRadius: 16, background: SURFACE, border: `1.5px solid ${BORDER}`, color: TEXT, fontSize: isBack ? 22 : 20, fontWeight: isBack ? 400 : 700, cursor: 'pointer', transition: 'background .12s' }}
                      onMouseDown={e => { e.currentTarget.style.background = SURFACE2 }}
                      onMouseUp={e => { e.currentTarget.style.background = SURFACE }}
                      onTouchStart={e => { e.currentTarget.style.background = SURFACE2 }}
                      onTouchEnd={e => { e.currentTarget.style.background = SURFACE }}
                    >{key}</button>
                  )
                })}
              </div>
              {gatePinErr && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{gatePinErr}</p>}
              <button onClick={handleSetPin} disabled={gatePin.length !== 4}
                style={{ width: '100%', background: gatePin.length === 4 ? ACCENT : SURFACE2, color: gatePin.length === 4 ? '#fff' : TEXT3, border: 'none', borderRadius: 16, padding: '17px 0', fontWeight: 800, fontSize: 16, cursor: gatePin.length === 4 ? 'pointer' : 'not-allowed', transition: 'background .2s, color .2s', marginBottom: 12 }}>
                {gatePin.length === 4 ? 'Confirmar PIN' : `${4 - gatePin.length} digito${4 - gatePin.length !== 1 ? 's' : ''} mas`}
              </button>
              <button onClick={() => { setGateStep('done') }} style={{ width: '100%', background: 'none', border: 'none', color: TEXT3, fontSize: 13, cursor: 'pointer', padding: '10px 0' }}
                onMouseEnter={e => (e.currentTarget.style.color = TEXT2)} onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}>
                Saltar, crear PIN despues
              </button>
            </>
          )}

          {/* Enter PIN */}
          {gateStep === 'enter-pin' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: TEXT, letterSpacing: '-0.04em', marginBottom: 10 }}>
                  Hola{gateCustomer?.full_name ? `, ${gateCustomer.full_name.split(' ')[0]}` : ''}
                </h1>
                <p style={{ color: TEXT2, fontSize: 14 }}>Ingresa tu PIN de 4 digitos</p>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ width: 52, height: 64, borderRadius: 14, background: SURFACE, border: `2px solid ${gatePin.length > i ? TEXT2 : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: TEXT, transition: 'border-color .2s', animation: gatePin.length === i + 1 ? 'pinPop .28s cubic-bezier(.34,1.56,.64,1)' : 'none' }}>
                    {gatePin.length > i ? '•' : ''}
                  </div>
                ))}
              </div>
              {/* Visible numeric PIN pad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
                  if (key === '') return <div key={i} />
                  const isBack = key === '⌫'
                  return (
                    <button key={i} type="button"
                      onClick={() => { if (isBack) setGatePin(p => p.slice(0, -1)); else if (gatePin.length < 4) setGatePin(p => p + key) }}
                      style={{ width: '100%', padding: '18px 0', borderRadius: 16, background: SURFACE, border: `1.5px solid ${BORDER}`, color: TEXT, fontSize: isBack ? 22 : 20, fontWeight: isBack ? 400 : 700, cursor: 'pointer', transition: 'background .12s' }}
                      onMouseDown={e => { e.currentTarget.style.background = SURFACE2 }}
                      onMouseUp={e => { e.currentTarget.style.background = SURFACE }}
                      onTouchStart={e => { e.currentTarget.style.background = SURFACE2 }}
                      onTouchEnd={e => { e.currentTarget.style.background = SURFACE }}
                    >{key}</button>
                  )
                })}
              </div>
              {gatePinErr && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{gatePinErr}</p>}
              <button onClick={handleEnterPin} disabled={gatePin.length !== 4}
                style={{ width: '100%', background: gatePin.length === 4 ? ACCENT : SURFACE2, color: gatePin.length === 4 ? '#fff' : TEXT3, border: 'none', borderRadius: 16, padding: '17px 0', fontWeight: 800, fontSize: 16, cursor: gatePin.length === 4 ? 'pointer' : 'not-allowed', transition: 'background .2s, color .2s', marginBottom: 12 }}>
                {gatePin.length === 4 ? 'Entrar' : `${4 - gatePin.length} digito${4 - gatePin.length !== 1 ? 's' : ''} mas`}
              </button>
              <button onClick={() => { setGateCustomer(gateCustomer); setGateStep('found') }} style={{ width: '100%', background: 'none', border: 'none', color: TEXT3, fontSize: 13, cursor: 'pointer', padding: '10px 0' }}
                onMouseEnter={e => (e.currentTarget.style.color = TEXT2)} onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}>
                Ver menu sin iniciar sesion
              </button>
            </>
          )}

          {/* Returning customer - found */}
          {gateStep === 'found' && gateCustomer && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: SURFACE2, border: `2px solid ${BORDER}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: TEXT, letterSpacing: '-0.04em', marginBottom: 6 }}>
                  {firstName ? `Hola, ${firstName}!` : 'Bienvenido!'}
                </h1>
                <p style={{ color: TEXT2, fontSize: 13 }}>Que gusto verte de nuevo</p>
              </div>

              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '20px 20px 18px', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
                  <div>
                    <p style={{ fontSize: 10, color: TEXT3, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Puntos</p>
                    <p style={{ fontSize: 38, fontWeight: 900, color: TEXT, letterSpacing: '-0.04em', lineHeight: 1 }}>{gateCustomer.points.toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 10, color: TEXT3, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Visitas</p>
                    <p style={{ fontSize: 38, fontWeight: 900, color: TEXT2, letterSpacing: '-0.04em', lineHeight: 1 }}>{gateCustomer.total_visits}</p>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: TEXT3 }}>{cycleVisits} de {VISITS_PER_PRIZE} visitas para tu premio</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: toNextPrize > 0 ? TEXT2 : '#22c55e' }}>{toNextPrize > 0 ? `${toNextPrize} mas` : 'Premio!'}</p>
                  </div>
                  <div style={{ height: 5, background: SURFACE2, borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, background: TEXT, borderRadius: 99, transition: 'width 1s cubic-bezier(.22,1,.36,1)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {Array.from({ length: VISITS_PER_PRIZE }).map((_, i) => (
                      <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: i < cycleVisits ? TEXT : SURFACE2, border: `2px solid ${i < cycleVisits ? TEXT : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i === VISITS_PER_PRIZE - 1 ? 11 : 9, transition: 'all .3s' }}>
                        {i === VISITS_PER_PRIZE - 1 ? '🎁' : <span style={{ color: i < cycleVisits ? BG : TEXT3, fontWeight: 700 }}>{i + 1}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {!gateHasPin && (
                <button onClick={() => { setGatePin(''); setGateStep('set-pin') }}
                  style={{ width: '100%', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '14px 0', fontWeight: 700, fontSize: 14, color: TEXT2, cursor: 'pointer', marginBottom: 10 }}>
                  Crear PIN para la proxima vez
                </button>
              )}
              <button onClick={() => setGateStep('done')} style={{ width: '100%', background: TEXT, color: BG, border: 'none', borderRadius: 16, padding: '17px 0', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
                Ver el menu
              </button>
            </>
          )}

        </div>
      </div>
    )
  }

  // ── STRIPE SCREEN ─────────────────────────────────────────────────────────
  if (payMethod === 'stripe' && stripeSecret && stripeOrderId) return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background: SURFACE, padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => setPayMethod('select')} style={{ background: SURFACE2, border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT }}>
          <X size={18} />
        </button>
        <div>
          <p style={{ color: TEXT, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Pagar con Stripe</p>
          <p style={{ color: TEXT2, fontSize: 11, marginTop: 2 }}>Orden {stripeOrderNum} · ${stripeTotal.toFixed(2)} MXN</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <svg width="44" height="20" viewBox="0 0 60 25" fill="none"><text x="0" y="18" fontSize="18" fontWeight="700" fill="#635bff" fontFamily="sans-serif">stripe</text></svg>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>
        <Elements stripe={stripePromise} options={{ clientSecret: stripeSecret, appearance: { theme: 'night' } }}>
          <StripeCheckoutForm orderId={stripeOrderId} orderNumber={stripeOrderNum} total={stripeTotal}
            onSuccess={(num) => { setPayMethod('select'); setStripeSecret(null); setPaySuccess(num) }}
            onBack={() => setPayMethod('select')}
          />
        </Elements>
      </div>
    </div>
  )

  // ── PAYMENT METHOD SELECTOR ───────────────────────────────────────────────
  if (paymentData && payMethod === 'select') return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui,-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: SURFACE, padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => { setPaymentData(null); setPayMethod('select') }} style={{ background: SURFACE2, border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT }}>
          <X size={18} />
        </button>
        <div>
          <p style={{ color: TEXT, fontWeight: 800, fontSize: 15 }}>Elige como pagar</p>
          <p style={{ color: TEXT2, fontSize: 11, marginTop: 2 }}>Orden {paymentData.order_number} · ${paymentData.total.toFixed(2)} MXN</p>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px', width: '100%' }}>
        <p style={{ fontSize: 13, color: TEXT2, textAlign: 'center', marginBottom: 24 }}>Selecciona tu metodo de pago preferido</p>
        {/* Stripe */}
        <button onClick={async () => {
            setStripeLoading(true); setStripeError(null)
            try {
              const { data } = await pub.post('/stripe/payment-intent', { order_id: paymentData.order_id })
              setStripeSecret(data.data.client_secret)
              setStripeOrderId(paymentData.order_id)
              setStripeOrderNum(paymentData.order_number)
              setStripeTotal(paymentData.total)
              setPayMethod('stripe')
            } catch (e: any) { setStripeError(e?.response?.data?.error ?? 'Error al conectar con Stripe') }
            setStripeLoading(false)
          }}
          disabled={stripeLoading}
          style={{ width: '100%', background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 20, padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, transition: 'border-color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = TEXT3)} onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#635bff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#fff"/></svg>
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: TEXT, marginBottom: 3 }}>{stripeLoading ? 'Conectando...' : 'Apple Pay / Google Pay / Tarjeta'}</p>
            <p style={{ fontSize: 12, color: TEXT2 }}>Powered by Stripe</p>
          </div>
        </button>
        {/* MP */}
        <button onClick={() => setPayMethod('mp')}
          style={{ width: '100%', background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 20, padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, transition: 'border-color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = TEXT3)} onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#009ee3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: TEXT, marginBottom: 3 }}>Mercado Pago</p>
            <p style={{ fontSize: 12, color: TEXT2 }}>Tarjeta, OXXO, cartera MP</p>
          </div>
        </button>
        {stripeError && <div style={{ background: '#1a0a0a', border: `1px solid #3d1515`, borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#f87171', marginTop: 8 }}>{stripeError}</div>}
      </div>
    </div>
  )

  // ── MP BRICK SCREEN ───────────────────────────────────────────────────────
  if (paymentData && payMethod === 'mp') return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background: SURFACE, padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => setPayMethod('select')} style={{ background: SURFACE2, border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT, flexShrink: 0 }}>
          <X size={18} />
        </button>
        <div>
          <p style={{ color: TEXT, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Completa tu pago</p>
          <p style={{ color: TEXT2, fontSize: 11, marginTop: 2 }}>Orden {paymentData.order_number} · ${paymentData.total.toFixed(2)} MXN</p>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>
        <p style={{ fontSize: 13, color: TEXT2, textAlign: 'center', marginBottom: 20 }}>Elige tu metodo de pago preferido</p>
        <div id="dsd-payment-brick" />
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: SURFACE, borderTop: `1px solid ${BORDER}`, padding: '12px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: TEXT3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#009ee3"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          Pago seguro con Mercado Pago
        </p>
      </div>
    </div>
  )

  // ── PAY SUCCESS ───────────────────────────────────────────────────────────
  if (paySuccess) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', background: SURFACE, border: `2px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={TEXT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, color: TEXT, letterSpacing: '-0.03em', marginBottom: 10 }}>
          {paidAtCounter ? 'Pedido enviado' : 'Pago exitoso'}
        </h1>
        <p style={{ fontSize: 15, color: TEXT2, lineHeight: 1.6, marginBottom: 28 }}>
          {paidAtCounter
            ? 'Tu pedido ya esta en cocina. Presenta este numero y paga al recoger.'
            : 'Tu pedido ya esta en camino a la cocina.'}
        </p>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '24px 28px', marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: TEXT3, textTransform: 'uppercase', marginBottom: 8 }}>Numero de orden</p>
          <p style={{ fontSize: 34, fontWeight: 900, color: TEXT, letterSpacing: '-0.03em' }}>{paySuccess}</p>
          <p style={{ marginTop: 12, fontSize: 13, color: TEXT2 }}>Tiempo estimado: 15-20 min</p>
        </div>
        {customer && (
          <p style={{ fontSize: 13, color: TEXT2, marginBottom: 20 }}>Puntos acumulados: <strong style={{ color: TEXT }}>{customer.points}</strong></p>
        )}
        <button onClick={() => setPaySuccess(null)} style={{ width: '100%', background: TEXT, color: BG, fontWeight: 800, fontSize: 16, padding: '16px 0', borderRadius: 18, border: 'none', cursor: 'pointer' }}>
          Hacer otro pedido
        </button>
      </div>
    </div>
  )

  // ── MP ERROR ──────────────────────────────────────────────────────────────
  if (mpError) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: SURFACE, border: `1px solid #3d1515`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <span style={{ fontSize: 36, color: '#f87171' }}>!</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: TEXT, marginBottom: 10 }}>Error al procesar pago</h1>
        <p style={{ color: TEXT2, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>{mpError}</p>
        <button onClick={() => setMpError(null)} style={{ width: '100%', background: TEXT, color: BG, fontWeight: 700, fontSize: 16, padding: '16px 0', borderRadius: 18, border: 'none', cursor: 'pointer' }}>
          Intentar de nuevo
        </button>
      </div>
    </div>
  )

  // ── MAIN LAYOUT ───────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(18px)', borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: ACCENT, fontWeight: 900, fontSize: 16, fontStyle: 'italic' }}>D</span>
          </div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 15, color: TEXT, letterSpacing: '-0.02em', lineHeight: 1.1 }}>DSD Restaurante</p>
            <p style={{ fontSize: 10, color: TEXT3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ordena en linea</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Customer badge */}
          {customer && (
            <button onClick={() => setProfileOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '7px 14px', cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = TEXT3)} onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
            >
              <User size={14} color={TEXT2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{customer.points} pts</span>
              <span style={{ fontSize: 11, color: TEXT3 }}>{TIER_LABELS[customer.tier]}</span>
            </button>
          )}
          <button className="add-btn" onClick={e => { addRipple(e); setDrawer(true) }}
            style={{ background: TEXT, color: BG, border: 'none', borderRadius: 12, padding: '9px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#d4d4d4')} onMouseLeave={e => (e.currentTarget.style.background = TEXT)}
          >
            <ShoppingCart size={15} />
            Carrito
            {totalItems > 0 && (
              <span key={countKey} className="count-pop" style={{ background: ACCENT, color: '#fff', borderRadius: 99, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} style={{ background: `linear-gradient(135deg, ${SURFACE} 0%, #0d0d0d 60%, #111 100%)`, padding: '80px 28px 88px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 55% at 70% 40%, rgba(240,240,240,.03) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="hero-h1" style={{ fontSize: 'clamp(40px,6vw,76px)', fontWeight: 900, color: TEXT, lineHeight: 1.04, letterSpacing: '-0.04em', marginBottom: 20 }}>
              Sabor autentico,<br />
              <span style={{ color: ACCENT }}>entregado</span> a ti
            </h1>
            <p className="hero-p" style={{ fontSize: 16, color: TEXT2, lineHeight: 1.75, maxWidth: 480, marginBottom: 36 }}>
              Tacos, quesadillas y mas. Todo preparado al momento con ingredientes frescos.
            </p>
            <div className="hero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="add-btn" onClick={e => { addRipple(e); document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' }) }}
                style={{ background: TEXT, color: BG, fontWeight: 800, fontSize: 15, padding: '14px 30px', borderRadius: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#d4d4d4')} onMouseLeave={e => (e.currentTarget.style.background = TEXT)}
              >
                Ordenar ahora <ChevronRight size={16} />
              </button>
              {customer && availRewards.length > 0 && (
                <button onClick={() => setDrawer(true)}
                  style={{ background: 'transparent', color: ACCENT, border: `1.5px solid ${ACCENT}`, fontWeight: 700, fontSize: 15, padding: '14px 24px', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,66,26,.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Gift size={15} /> {availRewards.length} recompensa{availRewards.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
          {/* Mosaic */}
          <div className="hero-mosaic" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: 300, flexShrink: 0 }}>
            {([
              { name: 'Taco de Birria',       borderRadius: '20px 4px 20px 4px', mt: '0' },
              { name: 'Taco de Pastor',        borderRadius: '4px 20px 4px 20px', mt: '-10px' },
              { name: 'Agua Fresca',           borderRadius: '4px 20px 4px 20px', mt: '10px' },
              { name: 'Quesadilla Sencilla',   borderRadius: '20px 4px 20px 4px', mt: '0' },
            ] as { name: string; borderRadius: string; mt: string }[]).map((item, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: item.borderRadius, overflow: 'hidden', marginTop: item.mt, transition: 'transform .3s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                <img src={photoFor(item.name)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .75 }} onError={e => { e.currentTarget.src = FALLBACK_PHOTO }} loading="eager" />
              </div>
            ))}
          </div>
        </div>
        {/* Info strip */}
        <div className="hero-info" style={{ maxWidth: 1060, margin: '48px auto 0', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {[
            { icon: <MapPin size={12} />,  text: 'Av. Reforma 245, Col. Centro' },
            { icon: <Clock size={12} />,   text: 'Lun-Dom 8am - 10pm' },
            { icon: <Phone size={12} />,   text: '(55) 1234-5678' },
            { icon: <Star size={12} fill={TEXT3} color={TEXT3} />, text: '4.9 de 5 en resenas' },
          ].map(({ icon, text }) => (
            <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 7, color: TEXT3, fontSize: 12, fontWeight: 500 }}>
              {icon}{text}
            </span>
          ))}
        </div>
      </section>

      {/* ── Rewards strip (McDonald's style) ── */}
      {customer && (
        <section style={{ background: SURFACE, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '32px 0' }}>
          <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: TEXT3, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Mis recompensas</p>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: TEXT, letterSpacing: '-0.035em', lineHeight: 1 }}>
                  {customer.points.toLocaleString()} <span style={{ fontSize: 15, fontWeight: 600, color: TEXT2 }}>puntos</span>
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 99, padding: '7px 14px' }}>
                <Gift size={13} color={TEXT2} />
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT2 }}>{availRewards.length} disponible{availRewards.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Empty rewards state */}
            {allRewards.length === 0 && (
              <div style={{ background: SURFACE2, border: `1px dashed ${BORDER}`, borderRadius: 20, padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Gift size={28} color={TEXT3} /></div>
                <p style={{ fontWeight: 700, fontSize: 14, color: TEXT2, marginBottom: 6 }}>Recompensas proximas</p>
                <p style={{ fontSize: 12, color: TEXT3, lineHeight: 1.6 }}>Sigue comprando para acumular puntos y canjear premios.</p>
              </div>
            )}

            {/* Cards horizontal scroll */}
            {allRewards.length > 0 && (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              {allRewards.map((reward, idx) => {
                const canAfford  = customer.points >= reward.points_required
                const isSelected = selectedReward?.id === reward.id
                const disc       = calcDiscount(reward, subtotal)
                const photo      = photoFor(reward.name)

                return (
                  <div key={reward.id}
                    onClick={() => { if (canAfford) { setSelectedReward(isSelected ? null : reward) } }}
                    style={{
                      flexShrink: 0, width: 200, borderRadius: 22,
                      background: isSelected ? '#17140b' : BG,
                      border: `2px solid ${isSelected ? ACCENT : canAfford ? '#2e2e2e' : BORDER}`,
                      cursor: canAfford ? 'pointer' : 'default',
                      opacity: canAfford ? 1 : 0.55,
                      overflow: 'hidden',
                      transition: 'all .22s cubic-bezier(.22,1,.36,1)',
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: isSelected ? `0 0 0 1px ${ACCENT}` : 'none',
                      animationDelay: `${idx * 60}ms`,
                    }}
                    onMouseEnter={e => { if (canAfford) { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.borderColor = isSelected ? ACCENT : '#3e3e3e' } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = isSelected ? 'scale(1.03)' : 'scale(1)'; e.currentTarget.style.borderColor = isSelected ? ACCENT : canAfford ? '#2e2e2e' : BORDER }}
                  >
                    {/* Image */}
                    <div style={{ height: 130, overflow: 'hidden', position: 'relative', background: SURFACE2 }}>
                      <img src={photo} alt={reward.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: canAfford ? 'none' : 'grayscale(50%) brightness(.7)', transition: 'transform .4s cubic-bezier(.22,1,.36,1)' }}
                        onError={e => { e.currentTarget.src = FALLBACK_PHOTO }}
                      />
                      {/* Points badge */}
                      <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(13,13,13,.82)', backdropFilter: 'blur(8px)', borderRadius: 99, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Star size={10} fill={TEXT} color={TEXT} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: TEXT }}>{reward.points_required.toLocaleString()} pts</span>
                      </div>
                      {/* Selected checkmark */}
                      {isSelected && (
                        <div style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                      {/* Lock overlay */}
                      {!canAfford && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,13,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '14px 14px 16px' }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: TEXT, marginBottom: 4, lineHeight: 1.25 }}>{reward.name}</p>
                      {reward.description && (
                        <p style={{ fontSize: 11, color: TEXT2, marginBottom: 10, lineHeight: 1.4 }}>{reward.description}</p>
                      )}
                      {canAfford ? (
                        <div style={{
                          background: isSelected ? ACCENT : TEXT,
                          color: isSelected ? '#fff' : BG,
                          borderRadius: 10, padding: '9px 0', textAlign: 'center', fontSize: 13, fontWeight: 800,
                          transition: 'background .18s',
                        }}>
                          {isSelected ? 'Seleccionado' : disc > 0 ? `Canjear -$${disc.toFixed(0)}` : 'Canjear'}
                        </div>
                      ) : (
                        <div style={{ borderRadius: 10, padding: '9px 0', textAlign: 'center', fontSize: 12, color: TEXT3, border: `1px solid ${BORDER}` }}>
                          Faltan {(reward.points_required - customer.points).toLocaleString()} pts
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Earn more card */}
              <div style={{ flexShrink: 0, width: 200, borderRadius: 22, background: 'transparent', border: `2px dashed ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '24px 20px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} color={TEXT3} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: TEXT2, marginBottom: 5 }}>Gana mas puntos</p>
                  <p style={{ fontSize: 11, color: TEXT3, lineHeight: 1.5 }}>1 punto por cada $10 en tu pedido</p>
                </div>
              </div>
            </div>
            )}

            {/* Selected reward notice */}
            {selectedReward && (
              <div style={{ marginTop: 16, background: '#17140b', border: `1px solid ${ACCENT}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Gift size={15} color={ACCENT} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{selectedReward.name} aplicado</p>
                    {calcDiscount(selectedReward, subtotal) > 0 && (
                      <p style={{ fontSize: 11, color: TEXT2 }}>-${calcDiscount(selectedReward, subtotal).toFixed(2)} en tu proximo pedido</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedReward(null)} style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', padding: 4 }} onMouseEnter={e => (e.currentTarget.style.color = '#f87171')} onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Menu */}
      <section id="menu-section" style={{ maxWidth: 1060, margin: '0 auto', padding: '56px 24px 120px' }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 34, fontWeight: 900, color: TEXT, letterSpacing: '-0.03em', marginBottom: 6 }}>Nuestro menu</h2>
          <p style={{ color: TEXT2, fontSize: 14 }}>Preparado al momento con ingredientes frescos</p>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 36, scrollbarWidth: 'none' }}>
          {[{ id: null, name: 'Todo' }, ...(data?.categories ?? [])].map((cat, i) => {
            const active = activeCategory === cat.id
            return (
              <button key={cat.id ?? 'all'} className="cat-pill add-btn" style={{ animationDelay: `${i * 50}ms`, flexShrink: 0, padding: '9px 22px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid ${active ? 'transparent' : BORDER}`, background: active ? TEXT : 'transparent', color: active ? BG : TEXT2, transition: 'all .18s', transform: active ? 'scale(1.03)' : 'scale(1)' }}
                onClick={e => { addRipple(e); switchCategory(cat.id) }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = TEXT3; e.currentTarget.style.color = TEXT } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT2 } }}
              >
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* Skeleton */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                <div className="skeleton" style={{ height: 188 }} />
                <div style={{ padding: '16px 18px 20px', background: SURFACE }}>
                  <div className="skeleton" style={{ height: 16, borderRadius: 8, marginBottom: 10, width: '60%' }} />
                  <div className="skeleton" style={{ height: 12, borderRadius: 6, marginBottom: 18, width: '80%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="skeleton" style={{ height: 22, borderRadius: 8, width: 55 }} />
                    <div className="skeleton" style={{ height: 36, width: 36, borderRadius: '50%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <p style={{ fontSize: 22, marginBottom: 12 }}>⚠️</p>
            <p style={{ color: TEXT, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No se pudo cargar el menu</p>
            <p style={{ color: TEXT2, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>El servidor puede estar iniciando. Espera unos segundos e intenta de nuevo.</p>
            <button onClick={() => refetch()}
              style={{ background: TEXT, color: BG, border: 'none', borderRadius: 14, padding: '13px 32px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <p style={{ fontSize: 22, marginBottom: 12 }}>🍽️</p>
            <p style={{ color: TEXT2, fontSize: 15 }}>No hay productos en esta categoria.</p>
          </div>
        )}

        {/* Product grid */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, opacity: filterAnim ? 0 : 1, transform: filterAnim ? 'translateY(8px)' : 'translateY(0)', transition: 'opacity .16s, transform .16s' }}>
            {filtered.map((p, idx) => {
              const inCart = cart.find(i => i.id === p.id)
              return (
                <div key={p.id} className="product-card"
                  style={{ background: SURFACE, borderRadius: 20, overflow: 'hidden', border: `1px solid ${BORDER}`, transition: 'box-shadow .25s, transform .25s, border-color .2s', animation: `cardReveal .48s cubic-bezier(.22,1,.36,1) both ${idx * 55}ms` } as React.CSSProperties}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,.5)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = TEXT3 }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = BORDER }}
                >
                  <div style={{ height: 192, overflow: 'hidden', position: 'relative', background: SURFACE2 }}>
                    <img src={photoFor(p.name)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.src = FALLBACK_PHOTO }} loading="lazy" />
                    {inCart && (
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(13,13,13,.85)', backdropFilter: 'blur(6px)', color: TEXT, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                        {inCart.qty} en carrito
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '16px 18px 20px' }}>
                    <h3 style={{ fontWeight: 800, fontSize: 15, color: TEXT, marginBottom: p.description ? 5 : 14, letterSpacing: '-0.01em' }}>{p.name}</h3>
                    {p.description && <p style={{ fontSize: 12, color: TEXT2, lineHeight: 1.55, marginBottom: 14 }}>{p.description}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 900, fontSize: 22, color: TEXT, letterSpacing: '-0.02em' }}>${p.price_mxn}</span>
                      {inCart ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button className="add-btn" onClick={e => { addRipple(e); setQty(p.id, inCart.qty - 1) }} style={{ width: 32, height: 32, borderRadius: '50%', background: SURFACE2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2, transition: 'background .15s' }} onMouseEnter={e => (e.currentTarget.style.background = BORDER)} onMouseLeave={e => (e.currentTarget.style.background = SURFACE2)}><Minus size={13} /></button>
                          <span style={{ fontWeight: 900, minWidth: 22, textAlign: 'center', color: TEXT, fontSize: 15 }}>{inCart.qty}</span>
                          <button className="add-btn" onClick={e => addToCart(p, e)} style={{ width: 32, height: 32, borderRadius: '50%', background: TEXT, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BG, transition: 'background .15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#d4d4d4')} onMouseLeave={e => (e.currentTarget.style.background = TEXT)}><Plus size={13} /></button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={e => addToCart(p, e)} style={{ width: 40, height: 40, borderRadius: '50%', background: TEXT, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BG, transition: 'background .18s, transform .18s' }} onMouseEnter={e => { e.currentTarget.style.background = '#d4d4d4'; e.currentTarget.style.transform = 'scale(1.12) rotate(5deg)' }} onMouseLeave={e => { e.currentTarget.style.background = TEXT; e.currentTarget.style.transform = '' }}><Plus size={17} /></button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Floating pill */}
      {totalItems > 0 && !drawer && (
        <button className="pill-in add-btn" onClick={e => { addRipple(e); setDrawer(true) }}
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: TEXT, color: BG, border: 'none', borderRadius: 99, padding: '14px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', zIndex: 50, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 12px 48px rgba(0,0,0,.6)', whiteSpace: 'nowrap', transition: 'background .15s, transform .2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#d4d4d4'; e.currentTarget.style.transform = 'translateX(-50%) scale(1.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = TEXT; e.currentTarget.style.transform = 'translateX(-50%) scale(1)' }}
        >
          <span style={{ background: ACCENT, color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 900 }}>{totalItems}</span>
          Ver mi pedido
          <span style={{ fontWeight: 900 }}>${total.toFixed(2)}</span>
        </button>
      )}

      {/* ── Cart drawer ── */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(5px)', zIndex: 200 }} />
          <div className="drawer-in" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460, background: SURFACE, zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 80px rgba(0,0,0,.5)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 20, color: TEXT, letterSpacing: '-0.025em' }}>Mi pedido</h2>
                <p style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>{totalItems} producto{totalItems !== 1 ? 's' : ''}</p>
              </div>
              <button className="add-btn" onClick={e => { addRipple(e); setDrawer(false) }} style={{ width: 36, height: 36, borderRadius: 11, background: SURFACE2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2, transition: 'background .15s' }} onMouseEnter={e => (e.currentTarget.style.background = BORDER)} onMouseLeave={e => (e.currentTarget.style.background = SURFACE2)}>
                <X size={16} />
              </button>
            </div>

            {/* ── Loyalty bar (visible when logged in) ── */}
            {customer && (
              <div style={{ padding: '14px 20px', background: SURFACE2, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: TEXT, letterSpacing: '-0.03em' }}>{customer.points.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>puntos</span>
                    <span style={{ marginLeft: 4, fontSize: 11, color: TIER_COLORS[customer.tier] ?? TEXT2, fontWeight: 700, textTransform: 'capitalize', background: 'rgba(255,255,255,.06)', borderRadius: 99, padding: '2px 8px' }}>
                      {TIER_LABELS[customer.tier]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 3, background: BORDER, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(((customer.total_visits % 8) / 8) * 100)}%`, background: TEXT, borderRadius: 99, transition: 'width .8s cubic-bezier(.22,1,.36,1)' }} />
                    </div>
                    <span style={{ fontSize: 10, color: TEXT3, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {customer.total_visits % 8}/8 visitas
                    </span>
                  </div>
                </div>
                <button onClick={() => { setDrawer(false); setProfileOpen(true) }}
                  style={{ width: 36, height: 36, borderRadius: 11, background: SURFACE, border: `1px solid ${BORDER}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={15} color={TEXT2} />
                </button>
              </div>
            )}

            {/* Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Tu nombre</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={customer?.full_name || 'Ej. Carlos Mendez'}
                  style={{ width: '100%', background: SURFACE2, border: `1.5px solid ${BORDER}`, borderRadius: 13, padding: '12px 15px', fontSize: 14, color: TEXT, transition: 'border-color .15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = TEXT3)} onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                />
              </div>

              {/* Mesa */}
              {tables && tables.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Mesa <span style={{ color: TEXT3, fontWeight: 400 }}>(opcional)</span></label>
                  <select value={tableId} onChange={e => setTableId(e.target.value)} style={{ width: '100%', background: SURFACE2, border: `1.5px solid ${BORDER}`, borderRadius: 13, padding: '12px 15px', fontSize: 14, color: tableId ? TEXT : TEXT2, cursor: 'pointer', appearance: 'none' }}>
                    <option value=''>Para llevar</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* Items */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Productos</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ background: SURFACE2, borderRadius: 16, padding: '13px 15px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 2 }}>{item.name}</p>
                        <p style={{ fontSize: 13, color: TEXT2, fontWeight: 600 }}>${(item.price * item.qty).toFixed(2)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <button onClick={() => setQty(item.id, item.qty - 1)} style={{ width: 30, height: 30, borderRadius: '50%', background: SURFACE, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2 }}><Minus size={12} /></button>
                        <span style={{ fontWeight: 900, minWidth: 20, textAlign: 'center', color: TEXT, fontSize: 14 }}>{item.qty}</span>
                        <button onClick={() => setQty(item.id, item.qty + 1)} style={{ width: 30, height: 30, borderRadius: '50%', background: TEXT, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BG }}><Plus size={12} /></button>
                        <button onClick={() => setQty(item.id, 0)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT3 }} onMouseEnter={e => (e.currentTarget.style.color = '#f87171')} onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Rewards / Discounts in cart ── */}
              {customer && allRewards.length > 0 && (
                <div style={{ background: SURFACE2, borderRadius: 18, padding: '16px', border: `1px solid ${BORDER}` }}>
                  {/* Section header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Gift size={15} color={TEXT2} />
                      <p style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>Premios y Descuentos</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: availRewards.length > 0 ? '#22c55e' : TEXT3, background: availRewards.length > 0 ? 'rgba(34,197,94,.1)' : 'transparent', borderRadius: 99, padding: '3px 9px' }}>
                      {availRewards.length > 0 ? `${availRewards.length} disponible${availRewards.length > 1 ? 's' : ''}` : `${customer.points} pts`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {allRewards.map(reward => {
                      const canAfford  = customer.points >= reward.points_required
                      const isSelected = selectedReward?.id === reward.id
                      const disc       = calcDiscount(reward, subtotal)
                      const isDiscount = reward.reward_type === 'discount' || reward.reward_type === 'percentage'

                      return (
                        <button key={reward.id} disabled={!canAfford} onClick={() => setSelectedReward(isSelected ? null : reward)}
                          style={{
                            background:    isSelected ? '#141209' : SURFACE,
                            border:        `1.5px solid ${isSelected ? ACCENT : canAfford ? '#303030' : BORDER}`,
                            borderRadius:  14,
                            padding:       '12px 14px',
                            cursor:        canAfford ? 'pointer' : 'not-allowed',
                            display:       'flex',
                            alignItems:    'center',
                            gap:           12,
                            textAlign:     'left',
                            transition:    'all .15s',
                            opacity:       canAfford ? 1 : 0.45,
                          }}
                          onMouseEnter={e => { if (canAfford && !isSelected) e.currentTarget.style.borderColor = TEXT2 }}
                          onMouseLeave={e => { if (canAfford && !isSelected) e.currentTarget.style.borderColor = '#303030' }}
                        >
                          {/* Icon */}
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: isSelected ? 'rgba(232,66,26,.15)' : SURFACE2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isDiscount
                              ? <span style={{ fontSize: 18 }}>💸</span>
                              : <span style={{ fontSize: 18 }}>🎁</span>
                            }
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: isSelected ? TEXT : canAfford ? TEXT : TEXT3 }}>{reward.name}</p>
                              {isDiscount && (
                                <span style={{ fontSize: 9, fontWeight: 800, color: ACCENT, background: 'rgba(232,66,26,.12)', borderRadius: 4, padding: '2px 5px', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                                  Desc.
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 11, color: canAfford ? TEXT2 : TEXT3 }}>
                              {reward.points_required} pts requeridos
                              {canAfford && disc > 0 ? ` · ahorras $${disc.toFixed(2)}` : ''}
                            </p>
                          </div>

                          {/* Right side */}
                          {isSelected ? (
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                          ) : canAfford ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>Canjear</span>
                          ) : (
                            <span style={{ fontSize: 10, color: TEXT3, flexShrink: 0, textAlign: 'right' }}>
                              -{(reward.points_required - customer.points)} pts
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {!customer && (
                    <p style={{ fontSize: 12, color: TEXT3, textAlign: 'center', marginTop: 10 }}>
                      Inicia sesion para ver tus recompensas disponibles
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Notas (opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alergias, sin picante..." rows={2}
                  style={{ width: '100%', background: SURFACE2, border: `1.5px solid ${BORDER}`, borderRadius: 13, padding: '12px 15px', fontSize: 14, color: TEXT, resize: 'none', fontFamily: 'inherit', transition: 'border-color .15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = TEXT3)} onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                />
              </div>

              {/* Payment method */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Metodo de pago</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { id: false, icon: '💳', title: 'Pagar ahora', sub: 'MP / Stripe / Tarjeta' },
                    { id: true,  icon: '🏪', title: 'Pagar en caja', sub: 'Al recoger tu pedido' },
                  ].map(opt => {
                    const active = payAtCounter === opt.id
                    return (
                      <button key={String(opt.id)} onClick={() => setPayAtCounter(opt.id)}
                        style={{ padding: '14px 10px', borderRadius: 14, border: `2px solid ${active ? TEXT2 : BORDER}`, background: active ? SURFACE2 : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = TEXT3 }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = BORDER }}
                      >
                        <div style={{ fontSize: 22, marginBottom: 5 }}>{opt.icon}</div>
                        <p style={{ fontSize: 12, fontWeight: 800, color: active ? TEXT : TEXT3, marginBottom: 2 }}>{opt.title}</p>
                        <p style={{ fontSize: 10, color: TEXT3, lineHeight: 1.3 }}>{opt.sub}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Totals */}
              <div style={{ background: SURFACE2, borderRadius: 18, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
                {[['Subtotal', `$${subtotal.toFixed(2)}`], ['IVA (16%)', `$${tax.toFixed(2)}`]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT2, marginBottom: 10 }}>
                    <span>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: ACCENT, marginBottom: 10 }}>
                    <span>Descuento ({selectedReward?.name})</span>
                    <span style={{ fontWeight: 700 }}>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20, color: TEXT, paddingTop: 12, borderTop: `1px solid ${BORDER}`, letterSpacing: '-0.025em' }}>
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}` }}>
              <button className="add-btn" onClick={e => { addRipple(e); placeOrder.mutate({ atCounter: payAtCounter }) }} disabled={cart.length === 0 || placeOrder.isPending}
                style={{ width: '100%', background: placeOrder.isPending ? TEXT3 : TEXT, color: BG, border: 'none', borderRadius: 16, padding: '17px 0', fontWeight: 800, fontSize: 15, cursor: placeOrder.isPending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: cart.length === 0 ? 0.4 : 1, transition: 'background .15s, opacity .15s' }}
                onMouseEnter={e => { if (!placeOrder.isPending && cart.length > 0) e.currentTarget.style.background = '#d4d4d4' }}
                onMouseLeave={e => { if (!placeOrder.isPending) e.currentTarget.style.background = TEXT }}
              >
                {placeOrder.isPending
                  ? (payAtCounter ? 'Enviando pedido...' : 'Preparando pago...')
                  : (payAtCounter ? `Enviar pedido · $${total.toFixed(2)}` : `Continuar al pago · $${total.toFixed(2)}`)}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: TEXT3, marginTop: 10 }}>
                {payAtCounter ? 'Tu pedido va a cocina — paga al recoger' : 'Pago seguro · Tu pedido llega a cocina despues del pago'}
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Profile drawer ── */}
      {profileOpen && customer && (
        <>
          <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(5px)', zIndex: 200 }} />
          <div className="profile-in" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 400, background: SURFACE, zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 80px rgba(0,0,0,.5)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontWeight: 900, fontSize: 19, color: TEXT, letterSpacing: '-0.025em' }}>Mi perfil</h2>
              <button onClick={() => setProfileOpen(false)} style={{ width: 36, height: 36, borderRadius: 11, background: SURFACE2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2 }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Identity */}
              <div style={{ background: SURFACE2, borderRadius: 18, padding: '20px', border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={22} color={TEXT2} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>{customer.full_name ?? 'Cliente'}</p>
                    <p style={{ fontSize: 12, color: TIER_COLORS[customer.tier] ?? TEXT2, fontWeight: 600, textTransform: 'capitalize' }}>{TIER_LABELS[customer.tier]}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: SURFACE, borderRadius: 14, padding: '14px 16px' }}>
                    <p style={{ fontSize: 10, color: TEXT3, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Puntos</p>
                    <p style={{ fontSize: 28, fontWeight: 900, color: TEXT, letterSpacing: '-0.03em' }}>{customer.points.toLocaleString()}</p>
                  </div>
                  <div style={{ background: SURFACE, borderRadius: 14, padding: '14px 16px' }}>
                    <p style={{ fontSize: 10, color: TEXT3, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Visitas</p>
                    <p style={{ fontSize: 28, fontWeight: 900, color: TEXT, letterSpacing: '-0.03em' }}>{customer.total_visits}</p>
                  </div>
                </div>
                {/* Visit progress */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={{ fontSize: 12, color: TEXT3 }}>{customer.total_visits % 8} de 8 visitas</p>
                    <p style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>{8 - (customer.total_visits % 8)} para el premio</p>
                  </div>
                  <div style={{ height: 4, background: BORDER, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((customer.total_visits % 8) / 8) * 100}%`, background: TEXT, borderRadius: 99, transition: 'width .8s cubic-bezier(.22,1,.36,1)' }} />
                  </div>
                </div>
              </div>

              {/* Rewards */}
              {allRewards.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Recompensas</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {allRewards.map(r => {
                      const canAfford = customer.points >= r.points_required
                      return (
                        <div key={r.id} style={{ background: SURFACE2, borderRadius: 14, padding: '12px 14px', border: `1px solid ${canAfford ? BORDER : BORDER}`, display: 'flex', alignItems: 'center', gap: 12, opacity: canAfford ? 1 : 0.5 }}>
                          <Gift size={15} color={canAfford ? TEXT : TEXT3} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{r.name}</p>
                            <p style={{ fontSize: 11, color: TEXT3 }}>{r.points_required} pts requeridos</p>
                          </div>
                          {canAfford
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,.08)', borderRadius: 99, padding: '3px 10px' }}>Disponible</span>
                            : <span style={{ fontSize: 11, color: TEXT3 }}>Faltan {r.points_required - customer.points} pts</span>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Logout */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}` }}>
              <button onClick={handleLogout} style={{ width: '100%', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '13px 0', fontWeight: 700, fontSize: 14, color: TEXT2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color .15s, color .15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171' }} onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT2 }}>
                <LogOut size={15} /> Cerrar sesion
              </button>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <footer style={{ background: SURFACE, borderTop: `1px solid ${BORDER}`, padding: '32px 28px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: SURFACE2, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: ACCENT, fontWeight: 900, fontSize: 13, fontStyle: 'italic' }}>D</span>
          </div>
          <span style={{ color: TEXT2, fontWeight: 700, fontSize: 14 }}>DSD Restaurante</span>
        </div>
        <p style={{ color: TEXT3, fontSize: 11 }}>Powered by DSD AI Solutions &copy; 2025</p>
      </footer>
    </div>
  )
}
