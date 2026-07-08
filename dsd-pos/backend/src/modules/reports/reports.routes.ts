import { Router } from 'express'
import { getDailySummary, getTopProducts, getSalesByHour, getTrends, getProductMix, getMargins } from './reports.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()
router.use(authenticate)
router.use(authorize('tenant_admin', 'manager'))

router.get('/daily', getDailySummary)
router.get('/top-products', getTopProducts)
router.get('/by-hour', getSalesByHour)
router.get('/trends', getTrends)
router.get('/product-mix', getProductMix)
router.get('/margins', getMargins)

export default router
