// Service worker de DSD POS — modo offline básico.
//
// Alcance deliberado (ver SECURITY.md / plan de la sesión para el porqué):
//   - Cachea SOLO respuestas GET de la API (menú, mesas, órdenes) para que el
//     personal pueda seguir VIENDO datos si la conexión se cae a media sesión.
//   - NO toca absolutamente nada bajo /_next/ (chunks JS, RSC payloads) ni
//     navegaciones HTML. Interceptar esas rutas con cache-first causó un bug
//     real: servía chunks viejos después de cada recompilación de Next.js,
//     produciendo ChunkLoadError y bucles de recarga. El navegador ya maneja
//     el cacheo de esos assets correctamente por su cuenta.
//   - NO intercepta ni encola peticiones de escritura (POST/PATCH/DELETE). Crear
//     una cola de sincronización offline para cobros/pedidos es una decisión de
//     arquitectura aparte — hacerlo mal arriesga cobros duplicados. Sin eso, un
//     pedido/pago intentado sin conexión simplemente falla con el manejo de
//     errores normal de la app (toast), en vez de fingir que se guardó.
const CACHE_NAME = 'dsd-pos-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Solo interceptamos llamadas a nuestra propia API. Todo lo demás (assets de
  // Next.js, HTML, fuentes, socket.io, etc.) pasa de largo sin tocar.
  if (!url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const resClone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone))
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})
