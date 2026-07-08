import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'DSD POS — Point of Sale',
  description: 'Sistema de Punto de Venta — DSD AI Solutions',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#111827',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased" style={{ background: '#f5f6fa', color: '#0f1117' }}>
        <ServiceWorkerRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
