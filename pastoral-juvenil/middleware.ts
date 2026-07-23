import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Para HTML y JSON, reduce caché agresivo de Cloudflare
  const response = NextResponse.next()

  // Esto OVERRIDE el caché agresivo de Cloudflare
  response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300')
  response.headers.set('CDN-Cache-Control', 'max-age=60')

  return response
}

// Aplica a todas las rutas
export const config = {
  matcher: ['/:path*'],
}
