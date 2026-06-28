import { Router } from 'express'
import { getDailySummary, getTopProducts, getSalesByHour } from './reports.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()
router.use(authenticate)
router.use(authorize('tenant_admin', 'manager'))

router.get('/daily', getDailySummary)
router.get('/top-products', getTopProducts)
router.get('/by-hour', getSalesByHour)

export default router
