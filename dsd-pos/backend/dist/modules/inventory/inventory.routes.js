"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("./inventory.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/ingredients', inventory_controller_1.getIngredients);
router.post('/ingredients', (0, auth_1.authorize)('tenant_admin', 'manager'), inventory_controller_1.createIngredient);
router.put('/ingredients/:id', (0, auth_1.authorize)('tenant_admin', 'manager'), inventory_controller_1.updateIngredient);
router.get('/recipes/:productId', inventory_controller_1.getRecipe);
router.post('/recipes/:productId', (0, auth_1.authorize)('tenant_admin', 'manager'), inventory_controller_1.saveRecipe);
router.get('/movements', (0, auth_1.authorize)('tenant_admin', 'manager'), inventory_controller_1.getMovements);
router.post('/movements', (0, auth_1.authorize)('tenant_admin', 'manager'), inventory_controller_1.addMovement);
router.get('/low-stock', inventory_controller_1.getLowStock);
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map