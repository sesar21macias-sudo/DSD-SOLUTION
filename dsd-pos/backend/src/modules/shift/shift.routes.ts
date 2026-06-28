import { Router } from 'express'
import { openShift, closeShift, getCurrentShift } from './shift.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/current', getCurrentShift)
router.post('/open', authorize('tenant_admin', 'manager', 'cashier'), openShift)
router.post('/close', authorize('tenant_admin', 'manager', 'cashier'), closeShift)

export default router
