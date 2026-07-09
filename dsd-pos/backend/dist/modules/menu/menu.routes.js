"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const menu_controller_1 = require("./menu.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Tables
router.get('/tables', menu_controller_1.getTables);
// Categories
router.get('/categories', menu_controller_1.getCategories);
router.post('/categories', (0, auth_1.authorize)('tenant_admin', 'manager'), menu_controller_1.createCategory);
router.put('/categories/:id', (0, auth_1.authorize)('tenant_admin', 'manager'), menu_controller_1.updateCategory);
router.delete('/categories/:id', (0, auth_1.authorize)('tenant_admin', 'manager'), menu_controller_1.deleteCategory);
// Products
router.get('/products', menu_controller_1.getProducts);
router.get('/products/:id', menu_controller_1.getProduct);
router.post('/products', (0, auth_1.authorize)('tenant_admin', 'manager'), menu_controller_1.createProduct);
router.put('/products/:id', (0, auth_1.authorize)('tenant_admin', 'manager'), menu_controller_1.updateProduct);
router.delete('/products/:id', (0, auth_1.authorize)('tenant_admin', 'manager'), menu_controller_1.deleteProduct);
exports.default = router;
//# sourceMappingURL=menu.routes.js.map