'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

// Registra el service worker (public/sw.js) y muestra un banner cuando el
// dispositivo pierde conexión. El SW solo cachea lecturas (GET); las acciones
// de cobro/pedido siguen fallando de forma normal sin conexión — este banner
// existe para que el personal sepa por qué, en vez de asumir que algo se rompió.
export function ServiceWorkerRegister() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.error('[SW] Error registrando:', err))
    }

    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white"
      style={{ background: '#dc2626' }}
    >
      <WifiOff size={13} />
      Sin conexión — puedes ver el menú y las mesas, pero los pedidos y pagos no se procesarán hasta reconectar.
    </div>
  )
}
