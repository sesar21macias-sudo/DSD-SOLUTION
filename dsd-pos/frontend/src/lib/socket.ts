import { io } from 'socket.io-client'

export const socket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4000', {
  autoConnect: false,
})
