'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { ShoppingBag, CheckCircle, ChevronRight, Loader2, AlertCircle, Clock } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

const pub = axios.create({ baseURL: API })

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  menu_products: { id: string; name: string } | null
}

interface Order {
  id: string
  order_number: string
  subtotal: number
  tax: number
  total: number
  status: string
  currency: string
  customer_name: string | null
  tip_amount: number
  tip_percent: number
  created_at: string
  order_items: OrderItem[]
}

interface PageData {
  tenant: { name: string; currency: string; mp_public_key: string | null }
  order: Order
}

const ACCENT = '#009ee3'   // Azul Mercado Pago
const DARK   = '#111111'
const GREEN  = '#00a650'

const TIP_OPTIONS = [
  { label: 'Sin propina', value: 0 },
  { label: '10%',         value: 10 },
  { label: '15%',         value: 15 },
  { label: '20%',         value: 20 },
]

export default function PagarPage() {
  const { tenantSlug, tableId } = useParams<{ tenantSlug: string; tableId: string }>()

  const [data,       setData]       = useState<PageData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [tipPercent, setTipPercent] = useState(10)
  const [customTip,  setCustomTip]  = useState('')
  const [paying,     setPaying]     = useState(false)
  const [payError,   setPayError]   = useState<string | null>(null)

  useEffect(() => {
    pub.get(`/mp/order/${tenantSlug}/${tableId}`)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.error ?? 'No se pudo cargar la orden'))
      .finally(() => setLoading(false))
  }, [tenantSlug, tableId])

  const effectiveTip = customTip !== '' ? Number(customTip) : tipPercent
  const subtotal     = Number(data?.order.subtotal ?? 0)
  const tax          = Number(data?.order.tax      ?? 0)
  const tipAmount    = Math.round(subtotal * (effectiveTip / 100) * 100) / 100
  const total        = subtotal + tax + tipAmount

  async function handlePay() {
    if (!data) return
    setPaying(true)
    setPayError(null)
    try {
      const { data: res } = await pub.post(`/mp/preference/${tenantSlug}`, {
        order_id:    data.order.id,
        tip_percent: effectiveTip,
      })
      window.location.href = res.data.init_point
    } catch (e: any) {
      setPayError(e.response?.data?.error ?? 'Error al generar el pago. Intenta de nuevo.')
      setPaying(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={36} color={ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 14, color: '#6b7280', fontSize: 15 }}>Cargando tu cuenta...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <AlertCircle size={36} color="#dc2626" />
        </div>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: '#111', marginBottom: 10 }}>Sin orden activa</h2>
        <p style={{ color: '#6b7280', lineHeight: 1.6 }}>{error ?? 'No encontramos una orden activa en esta mesa.'}</p>
        <p style={{ marginTop: 16, color: '#9ca3af', fontSize: 13 }}>Escanea el código QR del menú para ordenar primero.</p>
      </div>
    </div>
  )

  const { tenant, order } = data

  // ── Pagada ───────────────────────────────────────────────────────────────────
  if (order.status === 'paid') return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <CheckCircle size={64} color={GREEN} style={{ margin: '0 auto 20px', display: 'block' }} />
        <h2 style={{ fontWeight: 900, fontSize: 26, color: '#111', marginBottom: 10 }}>¡Cuenta pagada!</h2>
        <p style={{ color: '#16a34a', fontWeight: 600, fontSize: 16 }}>Orden {order.order_number}</p>
        <p style={{ marginTop: 12, color: '#6b7280', lineHeight: 1.6 }}>Gracias por tu visita. ¡Vuelve pronto!</p>
      </div>
    </div>
  )

  // ── Main ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Header */}
      <div style={{ background: DARK, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1f1f1f', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 15, fontStyle: 'italic' }}>D</span>
        </div>
        <div>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{tenant.name}</p>
          <p style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Tu cuenta · Orden {order.order_number}</p>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 120px' }}>

        {/* Items de la orden */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={16} color={ACCENT} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Tu pedido</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <Clock size={12} />
              {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {order.order_items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f9fafb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: DARK, color: '#fff', borderRadius: 6, width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {item.quantity}
                </span>
                <span style={{ fontSize: 14, color: '#111', fontWeight: 500 }}>{item.menu_products?.name ?? 'Producto'}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>
                ${Number(item.subtotal).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Propina */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px', marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 14 }}>¿Deseas dejar propina?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {TIP_OPTIONS.map(opt => {
              const active = customTip === '' && tipPercent === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => { setTipPercent(opt.value); setCustomTip('') }}
                  style={{
                    padding: '10px 6px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: active ? `2px solid ${ACCENT}` : '2px solid #e5e7eb',
                    background: active ? '#eff6ff' : '#fff',
                    color: active ? ACCENT : '#374151',
                    transition: 'all .15s',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, fontWeight: 600 }}>%</span>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Otra cantidad..."
              value={customTip}
              onChange={e => setCustomTip(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 12, border: `2px solid ${customTip !== '' ? ACCENT : '#e5e7eb'}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
            />
          </div>
          {tipAmount > 0 && (
            <p style={{ marginTop: 10, fontSize: 13, color: '#16a34a', fontWeight: 600, textAlign: 'center' }}>
              Propina: ${tipAmount.toFixed(2)} — ¡Gracias!
            </p>
          )}
        </div>

        {/* Resumen de totales */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px', marginBottom: 16 }}>
          {[
            ['Subtotal',     `$${subtotal.toFixed(2)}`],
            ['IVA (16%)',    `$${tax.toFixed(2)}`],
            ...(tipAmount > 0 ? [[`Propina (${effectiveTip}%)`, `$${tipAmount.toFixed(2)}`]] : []),
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6b7280', marginBottom: 10 }}>
              <span>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 22, color: '#111', paddingTop: 14, borderTop: '1px solid #f3f4f6', letterSpacing: '-0.02em' }}>
            <span>Total</span>
            <span>${total.toFixed(2)} <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>{tenant.currency}</span></span>
          </div>
        </div>

        {/* Error de pago */}
        {payError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.5 }}>{payError}</p>
          </div>
        )}
      </div>

      {/* Botón fijo en la parte inferior */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 20px', maxWidth: 480, margin: '0 auto' }}>
        <button
          onClick={handlePay}
          disabled={paying}
          style={{
            width: '100%', background: paying ? '#6b7280' : ACCENT, color: '#fff',
            fontWeight: 800, fontSize: 17, padding: '17px 0', borderRadius: 16,
            border: 'none', cursor: paying ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background .15s', boxShadow: paying ? 'none' : `0 4px 20px ${ACCENT}44`,
          }}
        >
          {paying
            ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Redirigiendo...</>
            : <><span>Pagar ${total.toFixed(2)}</span><ChevronRight size={20} /></>
          }
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={ACCENT}><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          Pago seguro con Mercado Pago
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
