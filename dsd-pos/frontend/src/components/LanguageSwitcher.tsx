'use client'

import { useLocaleStore } from '@/store/locale'

interface LanguageSwitcherProps {
  variant?: 'dark' | 'light'
}

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocaleStore()
  const active   = variant === 'dark' ? { background: 'rgba(255,255,255,0.12)', color: '#ffffff' } : { background: '#111827', color: '#ffffff' }
  const inactive = variant === 'dark' ? { color: '#6b7280' } : { color: '#9ca3af' }

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: variant === 'dark' ? 'rgba(255,255,255,0.06)' : '#f0f2f5' }}>
      {(['es', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className="px-2 py-1 rounded-md text-[11px] font-bold uppercase transition-all"
          style={locale === l ? active : inactive}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
