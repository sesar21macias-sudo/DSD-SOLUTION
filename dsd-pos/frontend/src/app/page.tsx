'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { DSDLogo } from '@/components/DSDLogo'
import { ShoppingCart, ChefHat, Star, BarChart2, Truck, LayoutGrid, ArrowRight, Check, Menu, X } from 'lucide-react'

const C = {
  bg: '#09090b', card: '#18181b', border: 'rgba(255,255,255,0.08)',
  accent: '#f97316', text: '#f4f4f5', muted: '#a1a1aa', faint: '#3f3f46',
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setV(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, v }
}

function useCountUp(target: number, active: boolean, ms = 1500) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf: number
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / ms, 1)
      setN(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, ms])
  return n
}

function MetricCard({ label, value, prefix = '', active }: { label: string; value: number; prefix?: string; active: boolean }) {
  const n = useCountUp(value, active)
  return (
    <div style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 158 }}>
      <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>{prefix}{n.toLocaleString('es-MX')}</p>
    </div>
  )
}

function BentoCard({ icon: Icon, title, body, variant = 'default', style: s }: { icon: React.ElementType; title: string; body: string; variant?: 'default' | 'accent'; style?: React.CSSProperties }) {
  const { ref, v } = useInView(0.1)
  return (
    <div ref={ref} style={{ background: variant === 'accent' ? C.accent : C.card, border: `1px solid ${variant === 'accent' ? 'transparent' : C.border}`, borderRadius: 20, padding: '28px 28px 32px', opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(20px)', transition: 'opacity .5s, transform .5s', ...s }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 18, background: variant === 'accent' ? 'rgba(0,0,0,0.18)' : `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={variant === 'accent' ? '#fff' : C.accent} strokeWidth={1.75} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: variant === 'accent' ? '#fff' : C.text, marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</h3>
      <p style={{ fontSize: 14, color: variant === 'accent' ? 'rgba(255,255,255,0.72)' : C.muted, lineHeight: 1.65 }}>{body}</p>
    </div>
  )
}

function StatCard({ n, label, delay }: { n: string; label: string; delay: number }) {
  const { ref, v } = useInView(0.1)
  return (
    <div ref={ref} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 20px', opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(16px)', transition: `opacity .5s ${delay}s, transform .5s ${delay}s` }}>
      <p style={{ fontSize: 'clamp(26px,4vw,34px)', fontWeight: 900, color: C.text, letterSpacing: '-0.03em', marginBottom: 6 }}>{n}</p>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{label}</p>
    </div>
  )
}

function Step({ n, title, body, side, delay, isLast }: { n: string; title: string; body: string; side: 'left' | 'right'; delay: number; isLast: boolean }) {
  const { ref, v } = useInView(0.2)
  const dot = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: v ? C.accent : C.card, border: `2px solid ${v ? C.accent : C.faint}`, transition: 'background .5s, border-color .5s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#fff' }}>{n}</div>
      {!isLast && <div style={{ width: 2, flex: 1, minHeight: 48, background: C.faint, marginTop: 4 }} />}
    </div>
  )
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transition: `opacity .6s ${delay}s, transform .6s ${delay}s`, transform: v ? 'none' : `translateX(${side === 'left' ? -16 : 16}px)` }}>
      {/* desktop zigzag */}
      <div className="step-desktop" style={{ display: 'grid', gridTemplateColumns: '1fr 72px 1fr', alignItems: 'flex-start', minHeight: isLast ? 'auto' : 120 }}>
        <div style={{ paddingRight: 28, paddingTop: 12, textAlign: 'right', visibility: side === 'left' ? 'visible' : 'hidden' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>{title}</h3>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{body}</p>
        </div>
        {dot}
        <div style={{ paddingLeft: 28, paddingTop: 12, visibility: side === 'right' ? 'visible' : 'hidden' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>{title}</h3>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{body}</p>
        </div>
      </div>
      {/* mobile stacked */}
      <div className="step-mobile" style={{ display: 'none', gap: 16, paddingBottom: isLast ? 0 : 32, alignItems: 'flex-start' }}>
        {dot}
        <div style={{ paddingTop: 10 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>{title}</h3>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{body}</p>
        </div>
      </div>
    </div>
  )
}

const NAMES = ['Tacos El Guero','La Burger Co','Sushi Nakama','El Molcajete','Pizza La Rocca','Carnitas Don Pepe','Mariscos La Playa','Burritos Tijuana','La Parrilla MX','Cafe Colima','Tortas El Rey','Barbacoa Hidalgo']

export default function LandingPage() {
  const [mob, setMob] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [heroIn, setHeroIn] = useState(false)
  const metricsRef = useRef<HTMLDivElement>(null)
  const [metricsIn, setMetricsIn] = useState(false)

  useEffect(() => {
    setTimeout(() => setHeroIn(true), 60)
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = metricsRef.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setMetricsIn(true); obs.disconnect() } }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, color: C.text, overflowX: 'hidden' }}>

      {/* NAV */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: 64, display: 'flex', alignItems: 'center', padding: '0 clamp(16px,5vw,64px)', background: scrolled ? 'rgba(9,9,11,0.92)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`, transition: 'background .3s, border-color .3s' }}>
        <DSDLogo size={32} showWordmark variant="dark" />
        <nav className="desk-nav" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {[['#features','Funciones'],['#pasos','Como funciona'],['#precio','Precio']].map(([h,l]) => (
            <Link key={h} href={h} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)} onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>{l}</Link>
          ))}
          <div style={{ width: 1, height: 18, background: C.faint, margin: '0 10px' }} />
          <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: C.muted, textDecoration: 'none', border: `1px solid ${C.faint}`, transition: 'color .15s, border-color .15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = C.text; (e.currentTarget as HTMLElement).style.borderColor = '#71717a' }}
            onMouseLeave={e => { e.currentTarget.style.color = C.muted; (e.currentTarget as HTMLElement).style.borderColor = C.faint }}>Entrar</Link>
          <Link href="/signup" style={{ marginLeft: 6, padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#fff', background: C.accent, textDecoration: 'none' }}>Empezar gratis</Link>
        </nav>
        <button onClick={() => setMob(o => !o)} className="mob-btn" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: C.text, display: 'none' }}>
          {mob ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {mob && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 199, background: C.card, borderBottom: `1px solid ${C.border}`, padding: '20px clamp(16px,5vw,48px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['#features','Funciones'],['#pasos','Como funciona'],['#precio','Precio']].map(([h,l]) => (
            <Link key={h} href={h} onClick={() => setMob(false)} style={{ color: C.muted, fontWeight: 600, textDecoration: 'none', padding: '10px 0', fontSize: 15, borderBottom: `1px solid ${C.border}` }}>{l}</Link>
          ))}
          <Link href="/login" onClick={() => setMob(false)} style={{ color: C.text, fontWeight: 600, textDecoration: 'none', padding: '10px 0' }}>Entrar</Link>
          <Link href="/signup" onClick={() => setMob(false)} style={{ display: 'flex', justifyContent: 'center', background: C.accent, color: '#fff', borderRadius: 12, padding: '13px 0', fontWeight: 700, textDecoration: 'none', marginTop: 4 }}>Empezar gratis</Link>
        </div>
      )}

      {/* HERO */}
      <section style={{ minHeight: '100svh', display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: 48, padding: '64px clamp(16px,5vw,80px) 56px' }} className="hero-grid">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: `${C.accent}15`, border: `1px solid ${C.accent}28`, borderRadius: 999, padding: '5px 14px', marginBottom: 28, opacity: heroIn ? 1 : 0, transform: heroIn ? 'none' : 'translateY(10px)', transition: 'opacity .6s, transform .6s' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, animation: 'pulse 2.5s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.04em' }}>Sistema POS para restaurantes</span>
          </div>
          <h1 style={{ fontSize: 'clamp(36px,6.5vw,76px)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.035em', marginBottom: 24, opacity: heroIn ? 1 : 0, transform: heroIn ? 'none' : 'translateY(18px)', transition: 'opacity .7s .1s, transform .7s .1s' }}>
            Vende mas.<br /><span style={{ color: C.accent }}>Pierde menos.</span><br />Crece rapido.
          </h1>
          <p style={{ fontSize: 'clamp(14px,1.8vw,17px)', color: C.muted, lineHeight: 1.7, maxWidth: 420, marginBottom: 36, opacity: heroIn ? 1 : 0, transform: heroIn ? 'none' : 'translateY(18px)', transition: 'opacity .7s .2s, transform .7s .2s' }}>
            POS, cocina, lealtad y reportes en un solo sistema. Sin instalaciones. Sin contratos.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', opacity: heroIn ? 1 : 0, transform: heroIn ? 'none' : 'translateY(18px)', transition: 'opacity .7s .3s, transform .7s .3s' }}>
            <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.accent, color: '#fff', borderRadius: 12, padding: '13px 26px', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 20px ${C.accent}45`, transition: 'transform .15s, box-shadow .15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${C.accent}55` }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 20px ${C.accent}45` }}>
              Crear cuenta gratis <ArrowRight size={15} />
            </Link>
            <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: C.muted, borderRadius: 12, padding: '13px 20px', fontWeight: 600, fontSize: 15, textDecoration: 'none', border: `1px solid ${C.faint}`, transition: 'color .15s, border-color .15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = C.text; (e.currentTarget as HTMLElement).style.borderColor = '#71717a' }}
              onMouseLeave={e => { e.currentTarget.style.color = C.muted; (e.currentTarget as HTMLElement).style.borderColor = C.faint }}>
              Ya tengo cuenta
            </Link>
          </div>
          <p style={{ marginTop: 18, fontSize: 12, color: C.faint, opacity: heroIn ? 1 : 0, transition: 'opacity .7s .45s' }}>Primer mes gratis. Sin tarjeta de credito.</p>
        </div>

        {/* photo + floating metric cards */}
        <div ref={metricsRef} className="hero-right" style={{ position: 'relative', height: 520, opacity: heroIn ? 1 : 0, transform: heroIn ? 'none' : 'scale(0.97)', transition: 'opacity .8s .15s, transform .8s .15s' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden' }}>
            <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=70&auto=format&fit=crop" alt="Restaurante moderno" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.42)' }} />
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${C.accent}20 0%, transparent 65%)` }} />
          </div>
          <div style={{ position: 'absolute', top: 22, left: 22 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(12px)', border: `1px solid ${C.border}`, borderRadius: 20, padding: '6px 12px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>En vivo</span>
            </div>
          </div>
          <div style={{ position: 'absolute', top: 22, right: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MetricCard label="Ordenes hoy" value={284} active={metricsIn} />
            <MetricCard label="Ventas del dia" value={47200} prefix="$" active={metricsIn} />
          </div>
          <div style={{ position: 'absolute', bottom: 22, left: 22 }}>
            <MetricCard label="Puntos canjeados" value={1840} active={metricsIn} />
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ background: C.accent, overflow: 'hidden', padding: '13px 0', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', animation: 'marquee 26s linear infinite' }}>
          {[...NAMES, ...NAMES].map((r, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 700, color: '#fff', padding: '0 28px', letterSpacing: '0.01em' }}>
              {r} <span style={{ opacity: 0.45, fontSize: 10 }}>+</span>
            </span>
          ))}
        </div>
      </div>

      {/* BENTO */}
      <section id="features" style={{ padding: 'clamp(64px,10vw,112px) clamp(16px,5vw,80px)' }}>
        <h2 style={{ fontSize: 'clamp(28px,5vw,52px)', fontWeight: 900, letterSpacing: '-0.03em', color: C.text, marginBottom: 48, lineHeight: 1.08 }}>
          Un sistema.<br /><span style={{ color: C.muted }}>Todo incluido.</span>
        </h2>
        <div className="bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <div style={{ gridColumn: '1/3', gridRow: '1/3' }}>
            <BentoCard icon={ShoppingCart} title="POS Inteligente" body="Punto de venta rapido con busqueda instantanea, variantes, descuentos y soporte para MXN y USD. Disenado para el ritmo de una cocina real." variant="accent" style={{ height: '100%', minHeight: 260 }} />
          </div>
          <div style={{ gridColumn: '3/4', gridRow: '1/2' }}>
            <BentoCard icon={LayoutGrid} title="Mesas" body="Asigna ordenes, divide cuentas y transfiere pedidos con un tap." style={{ height: '100%' }} />
          </div>
          <div style={{ gridColumn: '4/5', gridRow: '1/2' }}>
            <BentoCard icon={ChefHat} title="Cocina KDS" body="Pantalla en tiempo real via WebSocket. Sin papel, sin demoras." style={{ height: '100%' }} />
          </div>
          <div style={{ gridColumn: '3/5', gridRow: '2/3' }}>
            <BentoCard icon={Star} title="Programa de lealtad" body="Puntos, recompensas y niveles. Tus clientes se registran desde su telefono y tu base crece sola." style={{ height: '100%' }} />
          </div>
          <div style={{ gridColumn: '1/3', gridRow: '3/4' }}>
            <BentoCard icon={Truck} title="Delivery integrado" body="Zonas de reparto, rastreo de entregas y sincronizacion con cocina desde la misma pantalla." style={{ height: '100%' }} />
          </div>
          <div style={{ gridColumn: '3/5', gridRow: '3/4' }}>
            <BentoCard icon={BarChart2} title="Reportes y turnos" body="Ventas por categoria, rendimiento por empleado y cortes automaticos al cerrar el turno." style={{ height: '100%' }} />
          </div>
        </div>
      </section>

      {/* STATS + PROBLEM */}
      <section style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: 'clamp(64px,10vw,100px) clamp(16px,5vw,80px)' }}>
        <div className="split-grid" style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(24px,4vw,42px)', fontWeight: 900, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
              El caos de manejar<br />un restaurante con<br /><span style={{ color: C.accent }}>3 sistemas distintos</span><br />se acabo.
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, maxWidth: 360 }}>
              POS separado del inventario. Lealtad en otra app. Reportes en Excel.
              Con DSD todo vive en un solo lugar.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <StatCard n="2 min" label="Para registrarte y empezar a vender" delay={0} />
            <StatCard n="$0"    label="De costo el primer mes, sin tarjeta"  delay={0.08} />
            <StatCard n="99.9%" label="Uptime garantizado en produccion"      delay={0.16} />
            <StatCard n="24/7"  label="Soporte por WhatsApp incluido"         delay={0.24} />
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section id="pasos" style={{ padding: 'clamp(64px,10vw,112px) clamp(16px,5vw,80px)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: C.text, letterSpacing: '-0.03em', marginBottom: 64, textAlign: 'center', lineHeight: 1.1 }}>
            De cero a vendiendo<br />en minutos
          </h2>
          <Step n="01" title="Crea tu cuenta" body="Registra tu negocio en menos de 2 minutos. Elige moneda, configura tu IVA y obtén tu URL unica de restaurante." side="left" delay={0} isLast={false} />
          <Step n="02" title="Carga tu menu" body="Agrega productos, fotos, precios y categorias. Tu menu en linea y tu POS quedan sincronizados al instante." side="right" delay={0.08} isLast={false} />
          <Step n="03" title="Empieza a vender" body="Abre el POS, asigna mesas y cobra. Tus clientes acumulan puntos desde el primer dia." side="left" delay={0.16} isLast={true} />
        </div>
      </section>

      {/* PRICING */}
      <section id="precio" style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: 'clamp(64px,10vw,112px) clamp(16px,5vw,80px)' }}>
        <div className="split-grid" style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
              Claro, justo<br />y sin letra chica.
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>
              Un plan que incluye todo. Sin modulos de pago extra. Sin sorpresas en tu factura.
            </p>
            {['POS completo sin limite de ordenes','Programa de lealtad incluido','Pantalla de cocina en tiempo real','Hasta 3 usuarios del staff','Reportes y cortes de turno','Soporte por WhatsApp'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={11} color={C.accent} strokeWidth={3} />
                </div>
                <span style={{ fontSize: 14, color: C.muted }}>{item}</span>
              </div>
            ))}
          </div>

          {/* brutalist price card */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: C.accent, transform: 'translate(8px, 8px)' }} />
            <div style={{ position: 'relative', background: C.bg, border: `2px solid ${C.faint}`, borderRadius: 20, padding: '40px 36px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Plan Restaurante</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: C.text, letterSpacing: '-0.04em', lineHeight: 1 }}>$499</span>
                <span style={{ fontSize: 15, color: C.muted, marginBottom: 8 }}>MXN / mes</span>
              </div>
              <p style={{ fontSize: 13, color: C.faint, marginBottom: 36 }}>o $29 USD / mes segun tu region</p>
              <Link href="/signup" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: C.accent, color: '#fff', borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 16px ${C.accent}40`, transition: 'opacity .15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                Empezar gratis <ArrowRight size={15} />
              </Link>
              <p style={{ textAlign: 'center', fontSize: 12, color: C.faint, marginTop: 14 }}>Primer mes gratis. Cancela cuando quieras.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ background: C.accent, padding: 'clamp(64px,8vw,96px) clamp(16px,5vw,80px)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px,5vw,48px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.1 }}>
          Tu restaurante ya puede<br />funcionar mejor.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 36 }}>
          Crea tu cuenta hoy y empieza a vender con DSD POS en minutos.
        </p>
        <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fafafa', color: '#18181b', borderRadius: 14, padding: '15px 36px', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 6px 28px rgba(0,0,0,0.2)', transition: 'transform .15s, box-shadow .15s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.2)' }}>
          Crear mi cuenta gratis <ArrowRight size={16} />
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: 'clamp(28px,5vw,40px) clamp(16px,5vw,80px)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <DSDLogo size={28} showWordmark variant="dark" />
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['#features','Funciones'],['#pasos','Como funciona'],['#precio','Precio'],['/login','Entrar'],['/signup','Registrarse']].map(([h,l]) => (
              <Link key={h} href={h} style={{ fontSize: 13, color: C.faint, textDecoration: 'none', transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = C.muted)} onMouseLeave={e => (e.currentTarget.style.color = C.faint)}>{l}</Link>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.faint }}>&copy; {new Date().getFullYear()} DSD AI Solutions</p>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.78)}}
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr!important;padding-top:80px!important;min-height:auto!important;padding-bottom:48px!important}
          .hero-right{height:260px!important;margin-top:8px}
          .desk-nav{display:none!important}
          .mob-btn{display:flex!important}
          .split-grid{grid-template-columns:1fr!important;gap:40px!important}
          .bento-grid{grid-template-columns:1fr 1fr!important}
          .bento-grid>div{grid-column:auto!important;grid-row:auto!important}
          .step-desktop{display:none!important}
          .step-mobile{display:flex!important}
        }
      `}</style>
    </div>
  )
}
