'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { DSDLogo } from '@/components/DSDLogo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/useT'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const router  = useRouter()
  const { t }   = useT()
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
      toast.success(t('login.welcome', { name: data.data.user.fullName }))
      router.push('/pos')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('login.error')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const SYSTEM_FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif"
  const BLUE = '#007AFF'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#ffffff',
    border: '0.5px solid rgba(0,0,0,0.08)',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#1c1c1e',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: SYSTEM_FONT,
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f5f5f7', fontFamily: SYSTEM_FONT }}
    >
      <div className="w-full max-w-sm relative">
        <div className="flex justify-center mb-4">
          <LanguageSwitcher />
        </div>
        {/* Logo + heading */}
        <div className="text-center mb-8 flex flex-col items-center gap-4">
          <div style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.15))' }}>
            <DSDLogo size={56} variant="dark" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: '#1c1c1e' }}>{t('login.title')}</h1>
            <p className="text-[13px] mt-1" style={{ color: '#8e8e93' }}>{t('login.subtitle')}</p>
          </div>
        </div>

        {/* Card: vidrio esmerilado, esquinas grandes, sombra suave */}
        <form
          onSubmit={handleSubmit}
          className="rounded-[18px] p-6 space-y-3.5"
          style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        >
          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium" style={{ color: '#8e8e93' }}>
              {t('login.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@restaurante.com"
              required
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px ${BLUE}22` }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium" style={{ color: '#8e8e93' }}>
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ ...inputStyle, paddingRight: '44px' }}
                onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px ${BLUE}22` }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#c7c7cc' }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-3 rounded-[10px] text-white text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: BLUE, boxShadow: `0 4px 12px ${BLUE}4D` }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                {t('login.submitting')}
              </>
            ) : (
              <>
                <LogIn size={16} />
                {t('login.submit')}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: '#8e8e93' }}>
          ¿No tienes negocio registrado? <Link href="/signup" className="font-semibold" style={{ color: BLUE }}>Crea uno gratis</Link>
        </p>

        <p className="text-center text-xs mt-3" style={{ color: '#c7c7cc' }}>
          DSD AI Solutions © 2025
        </p>
      </div>
    </div>
  )
}
