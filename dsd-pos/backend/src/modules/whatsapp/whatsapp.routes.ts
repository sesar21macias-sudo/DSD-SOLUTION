import { Router } from 'express'
import { handleIncoming, getConversations } from './whatsapp.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

// Webhook de Twilio — público
router.post('/webhook/:tenantSlug', handleIncoming)

// Panel admin — ver conversaciones
router.get('/conversations', authenticate, authorize('tenant_admin', 'manager'), getConversations)

export default router
