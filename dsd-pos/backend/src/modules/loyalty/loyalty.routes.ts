import { Router } from 'express'
import {
  listCustomers, getCustomerByPhone,
  listRewards, createReward, updateReward, deleteReward,
  redeemReward,
} from './loyalty.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

router.use(authenticate)

// Telefonos y gasto de clientes son datos personales — no cualquier rol
// autenticado (mesero, cocina) debe poder verlos.
router.get('/customers', authorize('tenant_admin', 'manager', 'cashier'), listCustomers)
router.get('/customers/:phone', authorize('tenant_admin', 'manager', 'cashier'), getCustomerByPhone)

router.get('/rewards', listRewards)
router.post('/rewards', authorize('tenant_admin', 'manager'), createReward)
router.patch('/rewards/:id', authorize('tenant_admin', 'manager'), updateReward)
router.delete('/rewards/:id', authorize('tenant_admin', 'manager'), deleteReward)

router.post('/redeem', authorize('tenant_admin', 'manager', 'cashier'), redeemReward)

export default router
