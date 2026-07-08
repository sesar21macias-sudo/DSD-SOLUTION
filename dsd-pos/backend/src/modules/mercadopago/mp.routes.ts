import { Router } from 'express'
import { getOrderForPayment, createPreference, mpWebhook, processCardPayment } from './mp.controller'
import { paymentLimiter } from '../../middleware/rateLimit'

const router = Router()

router.get('/order/:tenantSlug/:tableId', getOrderForPayment)
router.post('/preference/:tenantSlug', paymentLimiter, createPreference)
router.post('/process-card/:tenantSlug', paymentLimiter, processCardPayment)
router.post('/webhook', mpWebhook)

export default router
