import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
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
import { errorHandler, notFound } from './middleware/errorHandler'

const app = express()
const httpServer = createServer(app)

export const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: true, credentials: true }))
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

// Socket.io — real-time kitchen display
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  socket.on('join:tenant', (tenantId: string) => {
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
