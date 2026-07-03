'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle, Star } from 'lucide-react'
import { useEffect, useState, Suspense } from 'react'

const GREEN = '#00a650'
const DARK  = '#111111'

function ExitoContent() {
  const params      = useSearchParams()
  const orderNumber = params.get('order') ?? ''
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <style>{`
        @keyframes checkIn  { 0%{transform:scale(0) rotate(-15deg);opacity:0} 65%{transform:scale(1.15) rotate(3deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes starPop  { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }
        .check-icon  { animation: checkIn .55s cubic-bezier(.34,1.56,.64,1) both }
        .slide-1     { animation: slideUp .5s ease both .3s }
        .slide-2     { animation: slideUp .5s ease both .45s }
        .slide-3     { animation: slideUp .5s ease both .6s }
        .star-1      { animation: starPop .4s cubic-bezier(.34,1.56,.64,1) both .7s }
        .star-2      { animation: starPop .4s cubic-bezier(.34,1.56,.64,1) both .8s }
        .star-3      { animation: starPop .4s cubic-bezier(.34,1.56,.64,1) both .9s }
      `}</style>

      {show && (
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>

          {/* Ícono animado */}
          <div className="check-icon" style={{
            width: 100, height: 100, borderRadius: '50%',
            background: '#fff', border: `3px solid ${GREEN}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px', boxShadow: `0 8px 32px ${GREEN}33`,
          }}>
            <CheckCircle size={52} color={GREEN} strokeWidth={2} />
          </div>

          {/* Textos */}
          <h1 className="slide-1" style={{ fontSize: 34, fontWeight: 900, color: DARK, letterSpacing: '-0.03em', marginBottom: 10 }}>
            ¡Pago exitoso!
          </h1>

          <p className="slide-2" style={{ fontSize: 16, color: '#374151', lineHeight: 1.6, marginBottom: 28 }}>
            Tu cuenta ha sido pagada correctamente.<br />
            ¡Gracias por tu visita!
          </p>

          {/* Número de orden */}
          {orderNumber && (
            <div className="slide-3" style={{
              background: '#fff', border: '1px solid #bbf7d0', borderRadius: 20,
              padding: '24px 28px', marginBottom: 28,
              boxShadow: '0 4px 20px rgba(0,166,80,.08)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>
                Orden
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: DARK, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                {orderNumber}
              </p>
              <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
                Guarda este número por si necesitas algún comprobante
              </p>
            </div>
          )}

          {/* Estrellas decorativas */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
            <Star className="star-1" size={22} fill="#fbbf24" color="#fbbf24" />
            <Star className="star-2" size={28} fill="#f59e0b" color="#f59e0b" />
            <Star className="star-3" size={22} fill="#fbbf24" color="#fbbf24" />
          </div>

          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            Puedes cerrar esta página
          </p>
        </div>
      )}
    </div>
  )
}

export default function ExitoPage() {
  return (
    <Suspense>
      <ExitoContent />
    </Suspense>
  )
}
