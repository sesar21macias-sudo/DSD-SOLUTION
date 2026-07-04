import { Router } from 'express'
import { getOrderForPayment, createPreference, mpWebhook, processCardPayment } from './mp.controller'

const router = Router()

router.get('/order/:tenantSlug/:tableId', getOrderForPayment)
router.post('/preference', createPreference)
router.post('/process-card', processCardPayment)
router.post('/webhook', mpWebhook)

export default router
