import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { getStatus, sendTest } from './wa.controller'

const router = Router()
router.use(authenticate)
router.use(authorize('tenant_admin'))

router.get('/status', getStatus)
router.post('/test', sendTest)

export default router
