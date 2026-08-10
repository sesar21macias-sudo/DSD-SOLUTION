import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { startOnboarding, getConnectStatus } from './stripe-connect.controller'

const router = Router()
router.use(authenticate)
router.use(authorize('tenant_admin'))

router.post('/onboard', startOnboarding)
router.get('/status', getConnectStatus)

export default router
