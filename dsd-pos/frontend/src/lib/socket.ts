import { io } from 'socket.io-client'

export const socket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4000', {
  autoConnect: false,
  // Forma función (no objeto estático): se reevalúa en cada intento de conexión/
  // reconexión, así el token está disponible aunque el socket se haya creado
  // antes del login.
  auth: (cb) => cb({ token: localStorage.getItem('pos_token') }),
})
