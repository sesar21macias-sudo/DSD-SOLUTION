import { Router } from 'express'
import { login, me, refreshToken, listUsers, createUser, updateUser } from './auth.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

router.post('/login', login)
router.get('/me', authenticate, me)
router.post('/refresh', authenticate, refreshToken)
router.get('/users', authenticate, authorize('tenant_admin', 'manager'), listUsers)
router.post('/users', authenticate, authorize('tenant_admin', 'manager'), createUser)
router.patch('/users/:id', authenticate, authorize('tenant_admin', 'manager'), updateUser)

export default router
