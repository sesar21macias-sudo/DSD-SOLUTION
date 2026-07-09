"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shift_controller_1 = require("./shift.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/current', shift_controller_1.getCurrentShift);
router.post('/open', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier'), shift_controller_1.openShift);
router.post('/close', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier'), shift_controller_1.closeShift);
exports.default = router;
//# sourceMappingURL=shift.routes.js.map