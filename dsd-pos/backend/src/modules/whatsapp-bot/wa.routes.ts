import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { getStatus, sendTest, incomingMessage } from './wa.controller'

const router = Router()

// Twilio llama este endpoint directo, sin JWT — tiene que ir antes del
// authenticate/authorize de abajo.
router.post('/incoming', incomingMessage)

router.use(authenticate)
router.use(authorize('tenant_admin'))

router.get('/status', getStatus)
router.post('/test', sendTest)

export default router
