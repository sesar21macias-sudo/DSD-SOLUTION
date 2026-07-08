'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  notes?: string | null
  modifiers?: { name: string; price: number }[]
  menu_products: { name: string } | null
}

interface Order {
  id: string
  order_number: string
  type: string
  status: string
  subtotal: number
  tax: number
  discount: number
  tip_amount: number
  total: number
  currency: string
  customer_name: string | null
  notes: string | null
  created_at: string
  order_items: OrderItem[]
  tables: { number: number; name: string } | null
  tenants: { name: string; address: string | null; phone: string | null } | null
}

// Ticket imprimible, optimizado para papel térmico de 80mm. Sirve tanto para la
// comanda de cocina (?kind=kitchen, sin precios) como para el recibo del cliente.
export default function PrintTicketPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const searchParams = useSearchParams()
  const kind = searchParams.get('kind') === 'kitchen' ? 'kitchen' : 'receipt'
  const router = useRouter()
  const user = useAuthStore(s => s.user)

  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Esta página se abre casi siempre en una pestaña nueva (window.open), es decir
  // con el store en frío: hay que esperar a que zustand termine de leer
  // localStorage antes de decidir si redirigir a /login, o se dispara un falso
  // redirect mientras la sesión todavía se está hidratando.
  // Ojo: `useAuthStore.persist` no existe durante el renderizado en el servidor
  // — hay que arrancar en `false` y solo tocarlo dentro de useEffect.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) { setHydrated(true); return }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!user) { router.replace('/login'); return }
    api.get(`/orders/${orderId}`)
      .then(r => setOrder(r.data.data))
      .catch(() => setError('No se pudo cargar la orden'))
  }, [orderId, user, hydrated, router])

  useEffect(() => {
    if (order && !window.location.search.includes('noprint')) {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
    return undefined
  }, [order])

  if (error) return <p style={{ padding: 24, fontFamily: 'monospace' }}>{error}</p>
  if (!order) return <p style={{ padding: 24, fontFamily: 'monospace' }}>Cargando ticket...</p>

  const sym = order.currency === 'USD' ? 'USD ' : '$'
  const fmt = (n: number) => `${sym}${Number(n).toFixed(2)}`

  return (
    <div className="ticket">
      <style>{`
        @page { size: 80mm auto; margin: 4mm; }
        body { background: #fff; }
        .ticket {
          width: 76mm;
          margin: 0 auto;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #000;
          line-height: 1.4;
        }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .big { font-size: 16px; }
        .no-print-btn { margin-top: 16px; }
        @media print { .no-print-btn { display: none; } }
      `}</style>

      <div className="center bold big">{order.tenants?.name ?? 'DSD Restaurante'}</div>
      {order.tenants?.address && <div className="center">{order.tenants.address}</div>}
      {order.tenants?.phone && <div className="center">{order.tenants.phone}</div>}

      <div className="line" />

      <div className="center bold">{kind === 'kitchen' ? 'COMANDA DE COCINA' : 'RECIBO'}</div>
      <div className="row"><span>Orden</span><span className="bold">{order.order_number}</span></div>
      {order.tables && <div className="row"><span>Mesa</span><span>{order.tables.number} — {order.tables.name}</span></div>}
      <div className="row"><span>Tipo</span><span>{order.type}</span></div>
      {order.customer_name && <div className="row"><span>Cliente</span><span>{order.customer_name}</span></div>}
      <div className="row"><span>Fecha</span><span>{new Date(order.created_at).toLocaleString('es-MX')}</span></div>

      <div className="line" />

      {order.order_items.map(item => (
        <div key={item.id} style={{ marginBottom: 4 }}>
          <div className="row">
            <span>{item.quantity}x {item.menu_products?.name ?? item.notes ?? 'Producto'}</span>
            {kind === 'receipt' && <span>{fmt(item.subtotal)}</span>}
          </div>
          {item.modifiers?.map((m, i) => (
            <div key={i} style={{ paddingLeft: 12, fontSize: 11 }}>+ {m.name}</div>
          ))}
          {item.menu_products && item.notes && <div style={{ paddingLeft: 12, fontSize: 11 }}>* {item.notes}</div>}
        </div>
      ))}

      <div className="line" />

      {kind === 'receipt' ? (
        <>
          <div className="row"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
          <div className="row"><span>IVA</span><span>{fmt(order.tax)}</span></div>
          {order.discount > 0 && <div className="row"><span>Descuento</span><span>-{fmt(order.discount)}</span></div>}
          {order.tip_amount > 0 && <div className="row"><span>Propina</span><span>{fmt(order.tip_amount)}</span></div>}
          <div className="line" />
          <div className="row bold big"><span>TOTAL</span><span>{fmt(order.total)}</span></div>
          <div className="line" />
          <div className="center">¡Gracias por su compra!</div>
        </>
      ) : (
        <div className="center bold">{order.order_items.reduce((s, i) => s + i.quantity, 0)} artículo(s)</div>
      )}

      <button className="no-print-btn" onClick={() => window.print()}>Imprimir de nuevo</button>
    </div>
  )
}
