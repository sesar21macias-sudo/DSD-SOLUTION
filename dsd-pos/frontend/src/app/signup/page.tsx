'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { DSDLogo } from '@/components/DSDLogo'
import toast from 'react-hot-toast'
import { Rocket } from 'lucide-react'
import Link from 'next/link'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '12px', padding: '12px 16px', fontSize: '14px',
  color: '#111827', outline: 'none', transition: 'border-color 0.15s',
}

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [businessName, setBusinessName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [currency, setCurrency] = useState<'MXN' | 'USD'>('MXN')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  function handleBusinessNameChange(value: string) {
    setBusinessName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/signup', { businessName, slug, currency, fullName, email, password })
      setAuth(data.data.user, data.data.token)
      toast.success(`¡Listo! ${data.data.tenant.name} está creado`)
      router.push('/pos')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al crear tu negocio'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#f5f6fa' }}>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8 flex flex-col items-center gap-4">
          <DSDLogo size={52} variant="dark" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827' }}>Crea tu negocio</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>Empieza a usar DSD POS en menos de un minuto</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Nombre del negocio</label>
            <input value={businessName} onChange={e => handleBusinessNameChange(e.target.value)}
              placeholder="Tacos El Güero" required style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>URL de tu negocio</label>
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
              <span className="px-3 py-3 text-xs" style={{ background: '#f0f2f5', color: '#9ca3af' }}>dsdpos.com/</span>
              <input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true) }}
                placeholder="tacos-el-guero" required
                style={{ ...inputStyle, border: 'none', borderRadius: 0 }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Moneda</label>
            <div className="grid grid-cols-2 gap-2">
              {(['MXN', 'USD'] as const).map(c => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  className="py-2.5 rounded-xl text-sm font-semibold transition"
                  style={currency === c ? { background: '#111827', color: '#fff' } : { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f0f2f5', margin: '4px 0' }} />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Tu nombre</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Juan García" required style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="juan@tacoselguero.com" required style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" required minLength={6} style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full font-semibold py-3 rounded-xl text-white text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: '#111827', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Creando...
              </>
            ) : (
              <>
                <Rocket size={16} />
                Crear mi negocio
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: '#9ca3af' }}>
          ¿Ya tienes cuenta? <Link href="/login" className="font-semibold" style={{ color: '#111827' }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
