import { Router } from 'express'
import {
  getIngredients, createIngredient, updateIngredient,
  getRecipe, saveRecipe,
  getMovements, addMovement,
  getLowStock,
} from './inventory.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/ingredients', getIngredients)
router.post('/ingredients', authorize('tenant_admin', 'manager'), createIngredient)
router.put('/ingredients/:id', authorize('tenant_admin', 'manager'), updateIngredient)

router.get('/recipes/:productId', getRecipe)
router.post('/recipes/:productId', authorize('tenant_admin', 'manager'), saveRecipe)

router.get('/movements', authorize('tenant_admin', 'manager'), getMovements)
router.post('/movements', authorize('tenant_admin', 'manager'), addMovement)

router.get('/low-stock', getLowStock)

export default router
