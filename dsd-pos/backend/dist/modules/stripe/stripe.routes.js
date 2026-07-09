"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_controller_1 = require("./stripe.controller");
const router = (0, express_1.Router)();
router.post('/payment-intent', stripe_controller_1.createPaymentIntent);
router.post('/confirm', stripe_controller_1.confirmStripePayment);
exports.default = router;
//# sourceMappingURL=stripe.routes.js.map