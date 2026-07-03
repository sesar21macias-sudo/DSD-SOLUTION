import { Router } from 'express'
import { getOrderForPayment, createPreference, mpWebhook } from './mp.controller'

const router = Router()

// Página de pago del cliente — obtener orden activa de la mesa
router.get('/order/:tenantSlug/:tableId', getOrderForPayment)

// Crear preferencia de Checkout Pro (llamado desde la página de pago)
router.post('/preference', createPreference)

// Webhook de confirmación de Mercado Pago (llamado por MP, no por el cliente)
router.post('/webhook', mpWebhook)

export default router
