"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("./whatsapp.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Webhook de Twilio — público
router.post('/webhook/:tenantSlug', whatsapp_controller_1.handleIncoming);
// Panel admin — ver conversaciones
router.get('/conversations', auth_1.authenticate, (0, auth_1.authorize)('tenant_admin', 'manager'), whatsapp_controller_1.getConversations);
exports.default = router;
//# sourceMappingURL=whatsapp.routes.js.map