'use client'

import { useEffect, useRef } from 'react'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth'

export function useSocket(handlers: Record<string, (data: unknown) => void> = {}) {
  const user = useAuthStore((s) => s.user)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!user) return

    // socket.off(event) sin referencia borra TODOS los listeners de ese evento,
    // no solo los de esta instancia — con eso, visitar una pantalla que tambien
    // escucha 'order:new' apagaba la notificacion global del layout al salir.
    // Guardamos la referencia exacta que registramos para solo quitar esa.
    const attached: [string, (data: unknown) => void][] = []

    function joinAndListen() {
      // El backend ignora cualquier tenantId del cliente y usa el del JWT verificado
      socket.emit('join:tenant')
      attached.forEach(([event, handler]) => socket.off(event, handler))
      attached.length = 0
      Object.entries(handlersRef.current).forEach(([event, handler]) => {
        socket.on(event, handler)
        attached.push([event, handler])
      })
    }

    if (socket.connected) {
      joinAndListen()
    } else {
      socket.connect()
      socket.once('connect', joinAndListen)
    }

    socket.on('reconnect', joinAndListen)

    return () => {
      attached.forEach(([event, handler]) => socket.off(event, handler))
      socket.off('reconnect', joinAndListen)
    }
  }, [user])
}
