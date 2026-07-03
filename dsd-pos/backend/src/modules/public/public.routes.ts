import { Router } from 'express'
import { getPublicMenu, createPublicOrder, getTableInfo, createOnlineOrder, getPublicTables } from './public.controller'

const router = Router()

router.get('/menu/:tenantSlug', getPublicMenu)
router.get('/tables/:tenantSlug', getPublicTables)
router.get('/table/:tenantSlug/:tableId', getTableInfo)
router.post('/order/:tenantSlug/:tableId', createPublicOrder)
router.post('/online-order/:tenantSlug', createOnlineOrder)

export default router
