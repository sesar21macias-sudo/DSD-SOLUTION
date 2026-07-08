import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'

import authRoutes from './modules/auth/auth.routes'
import menuRoutes from './modules/menu/menu.routes'
import ordersRoutes from './modules/orders/orders.routes'
import paymentsRoutes from './modules/payments/payments.routes'
import reportsRoutes from './modules/reports/reports.routes'
import shiftRoutes from './modules/shift/shift.routes'
import inventoryRoutes from './modules/inventory/inventory.routes'
import publicRoutes from './modules/public/public.routes'
import mpRoutes from './modules/mercadopago/mp.routes'
import whatsappRoutes from './modules/whatsapp/whatsapp.routes'
import loyaltyRoutes from './modules/loyalty/loyalty.routes'
import deliveryRoutes from './modules/delivery/delivery.routes'
import reservationsRoutes from './modules/reservations/reservations.routes'
import { errorHandler, notFound } from './middleware/errorHandler'

const app = express()
const httpServer = createServer(app)

// Railway (y la mayoría de PaaS) están detrás de un proxy — sin esto, cosas como
// express-rate-limit ven la IP del proxy en vez de la IP real del cliente.
app.set('trust proxy', 1)

const allowedOrigins = (process.env['FRONTEND_URL'] ?? 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({
  origin(origin, callback) {
    // Sin Origin = curl, health checks, webhooks server-to-server (ej. Mercado Pago)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Origen no permitido por CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/shift', shiftRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/mp', mpRoutes)
app.use('/api/whatsapp', whatsappRoutes)
app.use('/api/loyalty', loyaltyRoutes)
app.use('/api/delivery', deliveryRoutes)
app.use('/api/reservations', reservationsRoutes)

// Socket.io — real-time kitchen display. Solo lo usan las páginas autenticadas
// del dashboard (/pos/*); el flujo público de pago no depende de sockets.
io.use((socket, next) => {
  const token = socket.handshake.auth?.['token'] as string | undefined
  if (!token) { next(new Error('Token requerido')); return }
  try {
    const payload = jwt.verify(token, process.env['JWT_SECRET']!) as { tenantId: string; userId: string }
    socket.data['tenantId'] = payload.tenantId
    socket.data['userId'] = payload.userId
    next()
  } catch {
    next(new Error('Token inválido'))
  }
})

io.on('connection', (socket) => {
  const tenantId = socket.data['tenantId'] as string
  console.log(`[Socket] Client connected: ${socket.id} (tenant ${tenantId})`)

  socket.on('join:tenant', () => {
    // Ignora cualquier tenantId que mande el cliente: siempre usa el del JWT verificado
    socket.join(`tenant:${tenantId}`)
    console.log(`[Socket] ${socket.id} joined tenant:${tenantId}`)
  })

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })
})

app.use(notFound)
app.use(errorHandler)

const PORT = process.env['PORT'] ?? 4000
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 DSD POS Server running on http://0.0.0.0:${PORT}`)
})

export default app
