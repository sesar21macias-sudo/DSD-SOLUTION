import { Router } from 'express'
import { getPublicMenu, createPublicOrder, getTableInfo } from './public.controller'

const router = Router()

// Rutas públicas — sin autenticación (para clientes con QR)
router.get('/menu/:tenantSlug', getPublicMenu)
router.get('/table/:tenantSlug/:tableId', getTableInfo)
router.post('/order/:tenantSlug/:tableId', createPublicOrder)

export default router
