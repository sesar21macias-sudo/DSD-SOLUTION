'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { DSDLogo } from '@/components/DSDLogo'
import {
  ShoppingCart, ChefHat, Star, BarChart2, Truck, LayoutGrid,
  Check, ArrowRight, Zap, Shield, Globe, Menu, X
} from 'lucide-react'

/* ─── constants ─────────────────────────────────────────── */
const ACCENT  = '#f97316'
const DARK    = '#111827'
const MID     = '#374151'
const LIGHT   = '#6b7280'
const BORDER  = '#e5e7eb'
const BG_SOFT = '#f9fafb'

/* ─── tiny primitives ───────────────────────────────────── */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${ACCENT}14`, color: ACCENT,
      border: `1px solid ${ACCENT}30`, borderRadius: 999,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
      padding: '4px 12px',
    }}>{children}</span>
  )
}

function Btn({ href, variant = 'primary', children }: { href: string; variant?: 'primary' | 'outline' | 'ghost'; children: React.ReactNode }) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: '12px 24px', fontSize: 14,
    fontWeight: 700, textDecoration: 'none', transition: 'all .15s',
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
  }
  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background: DARK, color: '#fff' },
    outline: { ...base, background: 'transparent', color: DARK, border: `1.5px solid ${BORDER}` },
    ghost:   { ...base, background: 'transparent', color: LIGHT, padding: '12px 16px' },
  }
  return <Link href={href} style={styles[variant]}>{children}</Link>
}

const FEATURES = [
  { icon: ShoppingCart, title: 'POS Inteligente',        body: 'Punto de venta rapido con busqueda instantanea, variantes y descuentos por producto.' },
  { icon: LayoutGrid,   title: 'Gestion de Mesas',       body: 'Mapa de salon interactivo. Asigna ordenes a mesas, divide cuentas y transfiere pedidos.' },
  { icon: ChefHat,      title: 'Pantalla de Cocina',     body: 'KDS en tiempo real via WebSocket. Tiempos de preparacion y estado por orden.' },
  { icon: Star,         title: 'Programa de Lealtad',    body: 'Puntos, niveles y recompensas canjeables. Los clientes se registran desde su telefono.' },
  { icon: Truck,        title: 'Delivery Integrado',     body: 'Rastreo de entregas, zonas de reparto y sincronizacion con la cocina.' },
  { icon: BarChart2,    title: 'Reportes y Turnos',      body: 'Ventas por categoria, rendimiento por empleado, cortes de caja y mas.' },
]

const STEPS = [
  { n: '01', title: 'Crea tu cuenta',       body: 'Registra tu negocio en menos de 2 minutos. Elige moneda, tax rate y tu slug unico.' },
  { n: '02', title: 'Configura tu menu',    body: 'Agrega productos, fotos, precios y categorias. Tu menu en linea queda listo al instante.' },
  { n: '03', title: 'Empieza a vender',     body: 'Abre el POS, asigna mesas y cobra. Tus clientes ya pueden hacer pedidos y acumular puntos.' },
]

const PLAN_ITEMS = [
  'POS completo sin limite de ordenes',
  'Hasta 3 usuarios del staff',
  'Programa de lealtad incluido',
  'Pantalla de cocina en tiempo real',
  'Reportes mensuales',
  'Soporte por WhatsApp',
]

/* ─── main component ────────────────────────────────────── */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20) }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: DARK, background: '#fff', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: scrolled ? `1px solid ${BORDER}` : '1px solid transparent',
        background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        transition: 'all .2s',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <DSDLogo size={34} showWordmark variant="light" />

          {/* desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="hidden-mobile">
            <Btn href="#features"  variant="ghost">Funciones</Btn>
            <Btn href="#como-funciona" variant="ghost">Como funciona</Btn>
            <Btn href="#precio" variant="ghost">Precio</Btn>
            <div style={{ width: 1, height: 20, background: BORDER, margin: '0 8px' }} />
            <Btn href="/login"  variant="outline">Entrar</Btn>
            <Btn href="/signup" variant="primary">Empezar gratis <ArrowRight size={14} /></Btn>
          </nav>

          {/* mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
            className="show-mobile"
          >
            {mobileMenuOpen ? <X size={22} color={DARK} /> : <Menu size={22} color={DARK} />}
          </button>
        </div>

        {/* mobile menu */}
        {mobileMenuOpen && (
          <div style={{ background: '#fff', borderTop: `1px solid ${BORDER}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: MID, fontWeight: 600, textDecoration: 'none', padding: '8px 0' }}>Funciones</Link>
            <Link href="#como-funciona" onClick={() => setMobileMenuOpen(false)} style={{ color: MID, fontWeight: 600, textDecoration: 'none', padding: '8px 0' }}>Como funciona</Link>
            <Link href="#precio" onClick={() => setMobileMenuOpen(false)} style={{ color: MID, fontWeight: 600, textDecoration: 'none', padding: '8px 0' }}>Precio</Link>
            <div style={{ height: 1, background: BORDER }} />
            <Btn href="/login"  variant="outline">Entrar</Btn>
            <Btn href="/signup" variant="primary">Empezar gratis</Btn>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{ maxWidth: 1120, margin: '0 auto', padding: '80px 24px 72px' }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
          <Pill><Zap size={11} /> Sistema POS con IA</Pill>

          <h1 style={{
            fontSize: 'clamp(36px, 7vw, 68px)', fontWeight: 900, lineHeight: 1.08,
            letterSpacing: '-0.03em', color: DARK, margin: '22px 0 20px',
          }}>
            El POS que tu<br />
            <span style={{ color: ACCENT }}>restaurante merece.</span>
          </h1>

          <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', color: LIGHT, lineHeight: 1.65, maxWidth: 540, margin: '0 auto 36px' }}>
            Vende, gestiona mesas, controla tu cocina y fideliza clientes.
            Todo desde un solo sistema. Sin instalaciones, sin contratos.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Btn href="/signup" variant="primary">Crear cuenta gratis <ArrowRight size={14} /></Btn>
            <Btn href="/login"  variant="outline">Ya tengo cuenta</Btn>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: LIGHT }}>
            Sin tarjeta de credito requerida. Configuracion en 2 minutos.
          </p>
        </div>

        {/* Dashboard preview */}
        <div style={{
          marginTop: 60, borderRadius: 20, overflow: 'hidden',
          border: `1px solid ${BORDER}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.10)',
          background: DARK,
        }}>
          {/* browser chrome */}
          <div style={{ background: '#1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 6, height: 24, maxWidth: 280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>dsd-solution.vercel.app/pos</span>
            </div>
          </div>

          {/* mock UI */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 260px', minHeight: 380, background: '#f5f6fa' }}>
            {/* sidebar mock */}
            <div style={{ background: DARK, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['POS / Caja', 'Mesas', 'Ordenes', 'Cocina', 'Menu', 'Lealtad', 'Reportes'].map((label, i) => (
                <div key={label} style={{
                  padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
                  background: i === 0 ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: i === 0 ? '#fff' : '#4b5563', fontSize: 12, fontWeight: 600,
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: i === 0 ? '#fff' : '#374151', opacity: i === 0 ? 1 : 0.5 }} />
                  {label}
                </div>
              ))}
            </div>

            {/* products area */}
            <div style={{ padding: 20, overflowY: 'auto' }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: `1px solid ${BORDER}`, marginBottom: 16, fontSize: 12, color: LIGHT }}>
                Buscar producto...
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                {['Taco Birria', 'Taco Asada', 'Quesadilla', 'Agua Fresca', 'Burrito', 'Elote'].map((name, i) => (
                  <div key={name} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ height: 72, background: `hsl(${i * 37 + 14}, 60%, ${75 + i * 2}%)` }} />
                    <div style={{ padding: '8px 10px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: DARK, marginBottom: 2 }}>{name}</p>
                      <p style={{ fontSize: 11, color: ACCENT, fontWeight: 800 }}>$35.00</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* cart area */}
            <div style={{ background: '#fff', borderRight: 'none', borderLeft: `1px solid ${BORDER}`, padding: 20, display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: DARK, marginBottom: 14 }}>Orden #047</p>
              {[{ n: 'Taco Birria', q: 3, p: 105 }, { n: 'Agua Fresca', q: 2, p: 40 }, { n: 'Quesadilla', q: 1, p: 55 }].map(item => (
                <div key={item.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BG_SOFT}` }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: DARK }}>{item.n}</p>
                    <p style={{ fontSize: 11, color: LIGHT }}>x{item.q}</p>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: DARK }}>${item.p}</p>
                </div>
              ))}
              <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: LIGHT }}>Subtotal</span>
                  <span style={{ fontSize: 12, color: MID, fontWeight: 600 }}>$200.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: LIGHT }}>IVA 16%</span>
                  <span style={{ fontSize: 12, color: MID, fontWeight: 600 }}>$32.00</span>
                </div>
                <div style={{ background: DARK, borderRadius: 10, padding: '12px 0', textAlign: 'center' }}>
                  <p style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>Cobrar $232.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, background: BG_SOFT, padding: '20px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          {[
            { v: '< 2 min',  l: 'para registrarse' },
            { v: 'Sin costo', l: 'de instalacion' },
            { v: 'MX + US',   l: 'MXN y USD' },
            { v: 'Tiempo real', l: 'kitchen display' },
          ].map(({ v, l }) => (
            <div key={v} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: DARK }}>{v}</p>
              <p style={{ fontSize: 12, color: LIGHT, marginTop: 2 }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" style={{ maxWidth: 1120, margin: '0 auto', padding: '96px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Pill>Funciones</Pill>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, letterSpacing: '-0.025em', color: DARK, margin: '14px 0 12px' }}>
            Todo lo que tu negocio necesita
          </h2>
          <p style={{ fontSize: 16, color: LIGHT, maxWidth: 480, margin: '0 auto' }}>
            Sin modulos de pago extra. Sin sorpresas. Un sistema completo desde el primer dia.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 28px 32px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${ACCENT}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon size={20} color={ACCENT} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: DARK, marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 14, color: LIGHT, lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="como-funciona" style={{ background: DARK, padding: '96px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Pill><span style={{ color: ACCENT }}>Como funciona</span></Pill>
            <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, letterSpacing: '-0.025em', color: '#fff', margin: '14px 0 12px' }}>
              De cero a vendiendo en minutos
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {STEPS.map(({ n, title, body }) => (
              <div key={n} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '32px 28px' }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: ACCENT, letterSpacing: '0.06em', marginBottom: 14 }}>{n}</p>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.65 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="precio" style={{ maxWidth: 1120, margin: '0 auto', padding: '96px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Pill>Precio</Pill>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, letterSpacing: '-0.025em', color: DARK, margin: '14px 0 12px' }}>
            Claro, justo y sin letra chica
          </h2>
          <p style={{ fontSize: 16, color: LIGHT }}>Un plan para arrancar. Escala cuando tu negocio lo pida.</p>
        </div>

        <div style={{ maxWidth: 440, margin: '0 auto', background: '#fff', border: `2px solid ${DARK}`, borderRadius: 24, padding: '40px 36px', boxShadow: `8px 8px 0 ${DARK}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: DARK, letterSpacing: '-0.04em' }}>$499</span>
            <span style={{ fontSize: 14, color: LIGHT, marginBottom: 10 }}>MXN / mes</span>
          </div>
          <p style={{ fontSize: 13, color: LIGHT, marginBottom: 28 }}>o $29 USD / mes segun tu region</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {PLAN_ITEMS.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${ACCENT}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={11} color={ACCENT} strokeWidth={3} />
                </div>
                <span style={{ fontSize: 14, color: MID }}>{item}</span>
              </div>
            ))}
          </div>

          <Link href="/signup" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: DARK, color: '#fff', borderRadius: 12, padding: '14px 0',
            fontWeight: 800, fontSize: 15, textDecoration: 'none',
          }}>
            Empezar gratis <ArrowRight size={15} />
          </Link>
          <p style={{ textAlign: 'center', fontSize: 12, color: LIGHT, marginTop: 14 }}>
            Primer mes gratis. Cancela cuando quieras.
          </p>
        </div>
      </section>

      {/* ── CTA BOTTOM ── */}
      <section style={{ background: ACCENT, padding: '80px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(26px, 5vw, 40px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.025em', marginBottom: 16 }}>
            Listo para modernizar tu restaurante?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', marginBottom: 36 }}>
            Crea tu cuenta hoy y empieza a vender con DSD POS en minutos.
          </p>
          <Link href="/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', color: DARK, borderRadius: 14, padding: '14px 32px',
            fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            Crear mi cuenta gratis <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: DARK, padding: '40px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <DSDLogo size={30} showWordmark variant="dark" />
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Funciones',     href: '#features' },
              { label: 'Como funciona', href: '#como-funciona' },
              { label: 'Precio',        href: '#precio' },
              { label: 'Entrar',        href: '/login' },
              { label: 'Registrarse',   href: '/signup' },
            ].map(({ label, href }) => (
              <Link key={label} href={href} style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>
                {label}
              </Link>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#4b5563' }}>
            &copy; {new Date().getFullYear()} DSD AI Solutions
          </p>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @media (max-width: 680px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
        @media (min-width: 681px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
