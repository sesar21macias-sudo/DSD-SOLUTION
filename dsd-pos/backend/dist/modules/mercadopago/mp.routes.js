"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mp_controller_1 = require("./mp.controller");
const rateLimit_1 = require("../../middleware/rateLimit");
const router = (0, express_1.Router)();
router.get('/order/:tenantSlug/:tableId', mp_controller_1.getOrderForPayment);
router.post('/preference/:tenantSlug', rateLimit_1.paymentLimiter, mp_controller_1.createPreference);
router.post('/process-card/:tenantSlug', rateLimit_1.paymentLimiter, mp_controller_1.processCardPayment);
router.post('/webhook', mp_controller_1.mpWebhook);
exports.default = router;
//# sourceMappingURL=mp.routes.js.map