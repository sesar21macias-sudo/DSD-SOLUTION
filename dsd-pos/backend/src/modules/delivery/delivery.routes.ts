import { Router } from 'express'
import { getSettings, upsertSettings, regenerateSecret, receiveWebhook } from './delivery.controller'
import { authenticate, authorize } from '../../middleware/auth'
import { paymentLimiter } from '../../middleware/rateLimit'

const router = Router()

// Panel de configuración (autenticado)
router.get('/settings', authenticate, authorize('tenant_admin', 'manager'), getSettings)
router.post('/settings', authenticate, authorize('tenant_admin', 'manager'), upsertSettings)
router.post('/settings/regenerate-secret', authenticate, authorize('tenant_admin', 'manager'), regenerateSecret)

// Webhook público — lo llama el agregador (Chowly/Otter/Deliverect), no un usuario logueado.
// Se autentica con el header X-Webhook-Secret, no con JWT.
router.post('/webhook/:tenantSlug', paymentLimiter, receiveWebhook)

export default router
