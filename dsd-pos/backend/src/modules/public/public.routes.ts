import { Router } from 'express'
import {
  getPublicMenu, createPublicOrder, getTableInfo, createOnlineOrder, getPublicTables,
  identifyLoyaltyCustomer, setCustomerPin, loginCustomer, getCustomerProfile, googleAuthCustomer,
  getRecommendations, getPublicRewards,
} from './public.controller'
import { loginLimiter } from '../../middleware/rateLimit'

const router = Router()

router.get('/menu/:tenantSlug',            getPublicMenu)
router.get('/tables/:tenantSlug',          getPublicTables)
router.get('/table/:tenantSlug/:tableId',  getTableInfo)
router.post('/order/:tenantSlug/:tableId', createPublicOrder)
router.post('/online-order/:tenantSlug',   createOnlineOrder)
router.get('/recommendations/:tenantSlug', getRecommendations)

// Loyalty — public, no staff auth required. identify/set-pin/login son las
// puertas de entrada a datos de cliente (telefono, puntos) o a la cuenta
// misma (PIN) — sin rate limit se pueden fuerza-bruta o cosechar en masa.
router.get('/loyalty/rewards/:tenantSlug',   getPublicRewards)
router.post('/loyalty/identify/:tenantSlug', loginLimiter, identifyLoyaltyCustomer)
router.post('/loyalty/set-pin/:tenantSlug',  loginLimiter, setCustomerPin)
router.post('/loyalty/login/:tenantSlug',    loginLimiter, loginCustomer)
router.get('/loyalty/profile/:tenantSlug',   getCustomerProfile)
router.post('/loyalty/google/:tenantSlug',   googleAuthCustomer)

export default router
