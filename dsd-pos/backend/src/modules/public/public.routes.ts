import { Router } from 'express'
import {
  getPublicMenu, createPublicOrder, getTableInfo, createOnlineOrder, getPublicTables,
  identifyLoyaltyCustomer, setCustomerPin, loginCustomer, getCustomerProfile, googleAuthCustomer,
} from './public.controller'

const router = Router()

router.get('/menu/:tenantSlug',            getPublicMenu)
router.get('/tables/:tenantSlug',          getPublicTables)
router.get('/table/:tenantSlug/:tableId',  getTableInfo)
router.post('/order/:tenantSlug/:tableId', createPublicOrder)
router.post('/online-order/:tenantSlug',   createOnlineOrder)

// Loyalty — public, no staff auth required
router.post('/loyalty/identify/:tenantSlug', identifyLoyaltyCustomer)
router.post('/loyalty/set-pin/:tenantSlug',  setCustomerPin)
router.post('/loyalty/login/:tenantSlug',    loginCustomer)
router.get('/loyalty/profile/:tenantSlug',   getCustomerProfile)
router.post('/loyalty/google/:tenantSlug',   googleAuthCustomer)

export default router
