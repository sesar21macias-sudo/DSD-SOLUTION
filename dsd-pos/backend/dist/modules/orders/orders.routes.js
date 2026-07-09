"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orders_controller_1 = require("./orders.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', orders_controller_1.getOrders);
router.get('/:id', orders_controller_1.getOrder);
router.post('/', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier', 'waiter'), orders_controller_1.createOrder);
router.patch('/:id/status', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier', 'kitchen'), orders_controller_1.updateOrderStatus);
router.post('/:id/items', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier', 'waiter'), orders_controller_1.addOrderItem);
router.delete('/:id/items/:itemId', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier', 'waiter'), orders_controller_1.removeOrderItem);
router.patch('/:id/cancel', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier'), orders_controller_1.cancelOrder);
router.post('/:id/merge', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier'), orders_controller_1.mergeOrders);
router.post('/:id/discount', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier'), orders_controller_1.applyDiscount);
exports.default = router;
//# sourceMappingURL=orders.routes.js.map