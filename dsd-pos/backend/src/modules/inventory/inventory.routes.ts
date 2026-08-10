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

router.use(authorize('tenant_admin', 'manager'))

router.get('/ingredients', getIngredients)
router.post('/ingredients', createIngredient)
router.put('/ingredients/:id', updateIngredient)

router.get('/recipes/:productId', getRecipe)
router.post('/recipes/:productId', saveRecipe)

router.get('/movements', getMovements)
router.post('/movements', addMovement)

router.get('/low-stock', getLowStock)

export default router
