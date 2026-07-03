interface DSDLogoProps {
  size?: number
  showWordmark?: boolean
  variant?: 'dark' | 'light'
}

export function DSDLogo({ size = 36, showWordmark = false, variant = 'dark' }: DSDLogoProps) {
  const bg      = variant === 'dark' ? '#111827' : '#ffffff'
  const stroke  = variant === 'dark' ? '#ffffff' : '#111827'
  const borderC = variant === 'dark' ? 'transparent' : '#e5e7eb'

  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background */}
        <rect width="44" height="44" rx="10" fill={bg} stroke={borderC} strokeWidth="1"/>

        {/* D letterform — vertical bar */}
        <rect x="10" y="11" width="3.5" height="22" rx="1.75" fill={stroke}/>
        {/* D — top horizontal */}
        <rect x="10" y="11" width="15" height="3.5" rx="1.75" fill={stroke}/>
        {/* D — bottom horizontal */}
        <rect x="10" y="29.5" width="15" height="3.5" rx="1.75" fill={stroke}/>
        {/* D — curved right side */}
        <path
          d="M25 14.5 C31.5 14.5 34 17.5 34 22 C34 26.5 31.5 29.5 25 29.5"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Orange accent dot — brand signal */}
        <circle cx="37" cy="9" r="4" fill="#f97316"/>
      </svg>

      {showWordmark && (
        <div>
          <p className="font-bold text-sm leading-tight tracking-tight" style={{ color: stroke === '#ffffff' ? '#ffffff' : '#111827' }}>
            DSD POS
          </p>
          <p className="text-[10px] leading-tight" style={{ color: stroke === '#ffffff' ? '#9ca3af' : '#6b7280' }}>
            AI Solutions
          </p>
        </div>
      )}
    </div>
  )
}
