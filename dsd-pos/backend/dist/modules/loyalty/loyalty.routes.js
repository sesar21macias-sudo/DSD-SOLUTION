"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const loyalty_controller_1 = require("./loyalty.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/customers', loyalty_controller_1.listCustomers);
router.get('/customers/:phone', loyalty_controller_1.getCustomerByPhone);
router.get('/rewards', loyalty_controller_1.listRewards);
router.post('/rewards', (0, auth_1.authorize)('tenant_admin', 'manager'), loyalty_controller_1.createReward);
router.patch('/rewards/:id', (0, auth_1.authorize)('tenant_admin', 'manager'), loyalty_controller_1.updateReward);
router.delete('/rewards/:id', (0, auth_1.authorize)('tenant_admin', 'manager'), loyalty_controller_1.deleteReward);
router.post('/redeem', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier'), loyalty_controller_1.redeemReward);
exports.default = router;
//# sourceMappingURL=loyalty.routes.js.map