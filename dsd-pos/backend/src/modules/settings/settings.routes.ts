import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { getSettings, updateSettings, exportData } from './settings.controller'

const router = Router()
router.use(authenticate)
router.get('/',  getSettings)
router.put('/',  authorize('tenant_admin', 'manager'), updateSettings)
router.get('/export', authorize('tenant_admin'), exportData)

export default router
