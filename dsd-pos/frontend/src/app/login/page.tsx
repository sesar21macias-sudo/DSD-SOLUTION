'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { DSDLogo } from '@/components/DSDLogo'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router  = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email,    setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]  = useState(false)
  const [loading,  setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.data.user, data.data.token)
      toast.success(`Bienvenido, ${data.data.user.fullName}`)
      router.push('/pos')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f5f6fa' }}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Logo + heading */}
        <div className="text-center mb-8 flex flex-col items-center gap-4">
          <DSDLogo size={52} variant="dark" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827' }}>DSD POS</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>Sistema de Punto de Venta</p>
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        >
          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@restaurante.com"
              required
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ ...inputStyle, paddingRight: '44px' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#9ca3af' }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-3 rounded-xl text-white text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: '#111827', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Entrando...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Iniciar sesión
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: '#d1d5db' }}>
          DSD AI Solutions © 2025
        </p>
      </div>
    </div>
  )
}
