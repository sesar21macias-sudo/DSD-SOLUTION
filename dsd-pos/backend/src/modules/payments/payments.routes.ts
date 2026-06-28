import { Router } from 'express'
import { processPayment, getOrderPayments } from './payments.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

router.use(authenticate)
router.post('/', authorize('tenant_admin', 'manager', 'cashier'), processPayment)
router.get('/order/:orderId', getOrderPayments)

export default router
