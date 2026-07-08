import { Router } from 'express'
import {
  listCustomers, getCustomerByPhone,
  listRewards, createReward, updateReward, deleteReward,
  redeemReward,
} from './loyalty.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/customers', listCustomers)
router.get('/customers/:phone', getCustomerByPhone)

router.get('/rewards', listRewards)
router.post('/rewards', authorize('tenant_admin', 'manager'), createReward)
router.patch('/rewards/:id', authorize('tenant_admin', 'manager'), updateReward)
router.delete('/rewards/:id', authorize('tenant_admin', 'manager'), deleteReward)

router.post('/redeem', authorize('tenant_admin', 'manager', 'cashier'), redeemReward)

export default router
