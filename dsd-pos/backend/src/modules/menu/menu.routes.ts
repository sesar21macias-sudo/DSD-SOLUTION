import { Router } from 'express'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getTables,
} from './menu.controller'
import { authenticate, authorize } from '../../middleware/auth'

const router = Router()

router.use(authenticate)

// Tables
router.get('/tables', getTables)

// Categories
router.get('/categories', getCategories)
router.post('/categories', authorize('tenant_admin', 'manager'), createCategory)
router.put('/categories/:id', authorize('tenant_admin', 'manager'), updateCategory)
router.delete('/categories/:id', authorize('tenant_admin', 'manager'), deleteCategory)

// Products
router.get('/products', getProducts)
router.get('/products/:id', getProduct)
router.post('/products', authorize('tenant_admin', 'manager'), createProduct)
router.put('/products/:id', authorize('tenant_admin', 'manager'), updateProduct)
router.delete('/products/:id', authorize('tenant_admin', 'manager'), deleteProduct)

export default router
