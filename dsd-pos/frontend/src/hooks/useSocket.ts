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

    function joinAndListen() {
      socket.emit('join:tenant', user!.tenantId)
      Object.entries(handlersRef.current).forEach(([event, handler]) => {
        socket.off(event)
        socket.on(event, handler)
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
      Object.keys(handlersRef.current).forEach(event => socket.off(event))
      socket.off('reconnect', joinAndListen)
    }
  }, [user])
}
