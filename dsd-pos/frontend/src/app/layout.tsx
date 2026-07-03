import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'DSD POS — Point of Sale',
  description: 'Sistema de Punto de Venta — DSD AI Solutions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased" style={{ background: '#f5f6fa', color: '#0f1117' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
