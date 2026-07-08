import { Router } from 'express'
import {
  getOrders, getOrder, createOrder, updateOrderStatus,
  addOrderItem, removeOrderItem, cancelOrder, mergeOrders, applyDiscount,
} from './orders.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', getOrders)
router.get('/:id', getOrder)
router.post('/', authorize('tenant_admin', 'manager', 'cashier', 'waiter'), createOrder)
router.patch('/:id/status', authorize('tenant_admin', 'manager', 'cashier', 'kitchen'), updateOrderStatus)
router.post('/:id/items', authorize('tenant_admin', 'manager', 'cashier', 'waiter'), addOrderItem)
router.delete('/:id/items/:itemId', authorize('tenant_admin', 'manager', 'cashier', 'waiter'), removeOrderItem)
router.patch('/:id/cancel', authorize('tenant_admin', 'manager', 'cashier'), cancelOrder)
router.post('/:id/merge', authorize('tenant_admin', 'manager', 'cashier'), mergeOrders)
router.post('/:id/discount', authorize('tenant_admin', 'manager', 'cashier'), applyDiscount)

export default router
