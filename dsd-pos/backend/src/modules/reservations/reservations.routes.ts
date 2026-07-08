import { Router } from 'express'
import { getReservations, createReservation, updateReservation } from './reservations.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', getReservations)
router.post('/', authorize('tenant_admin', 'manager', 'cashier', 'waiter'), createReservation)
router.patch('/:id', authorize('tenant_admin', 'manager', 'cashier', 'waiter'), updateReservation)

export default router
