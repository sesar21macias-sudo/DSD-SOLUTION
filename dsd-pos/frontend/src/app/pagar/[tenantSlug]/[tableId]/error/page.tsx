'use client'

import { useParams } from 'next/navigation'
import { XCircle, RefreshCw } from 'lucide-react'

const ACCENT = '#009ee3'

export default function ErrorPage() {
  const { tenantSlug, tableId } = useParams<{ tenantSlug: string; tableId: string }>()

  return (
    <div style={{
      minHeight: '100vh', background: '#fef2f2',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: '#fff', border: '2px solid #fecaca',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', boxShadow: '0 4px 20px rgba(220,38,38,.1)',
        }}>
          <XCircle size={46} color="#dc2626" />
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', letterSpacing: '-0.025em', marginBottom: 12 }}>
          Pago no completado
        </h1>
        <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 32 }}>
          El pago fue cancelado o hubo un error. Tu orden sigue activa, puedes intentarlo de nuevo.
        </p>

        <button
          onClick={() => window.location.href = `/pagar/${tenantSlug}/${tableId}`}
          style={{
            width: '100%', background: ACCENT, color: '#fff',
            fontWeight: 700, fontSize: 16, padding: '16px 0',
            borderRadius: 16, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <RefreshCw size={17} />
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
