"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payments_controller_1 = require("./payments.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.post('/', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier'), payments_controller_1.processPayment);
router.get('/order/:orderId', payments_controller_1.getOrderPayments);
exports.default = router;
//# sourceMappingURL=payments.routes.js.map