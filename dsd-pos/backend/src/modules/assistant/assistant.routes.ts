import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { chat } from './assistant.controller'

const router = Router()
router.use(authenticate)
router.use(authorize('tenant_admin'))

router.post('/chat', chat)

export default router
