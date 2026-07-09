"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const delivery_controller_1 = require("./delivery.controller");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const router = (0, express_1.Router)();
// Panel de configuración (autenticado)
router.get('/settings', auth_1.authenticate, (0, auth_1.authorize)('tenant_admin', 'manager'), delivery_controller_1.getSettings);
router.post('/settings', auth_1.authenticate, (0, auth_1.authorize)('tenant_admin', 'manager'), delivery_controller_1.upsertSettings);
router.post('/settings/regenerate-secret', auth_1.authenticate, (0, auth_1.authorize)('tenant_admin', 'manager'), delivery_controller_1.regenerateSecret);
// Webhook público — lo llama el agregador (Chowly/Otter/Deliverect), no un usuario logueado.
// Se autentica con el header X-Webhook-Secret, no con JWT.
router.post('/webhook/:tenantSlug', rateLimit_1.paymentLimiter, delivery_controller_1.receiveWebhook);
exports.default = router;
//# sourceMappingURL=delivery.routes.js.map