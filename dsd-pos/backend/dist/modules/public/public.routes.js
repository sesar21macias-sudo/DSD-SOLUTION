"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const public_controller_1 = require("./public.controller");
const router = (0, express_1.Router)();
router.get('/menu/:tenantSlug', public_controller_1.getPublicMenu);
router.get('/tables/:tenantSlug', public_controller_1.getPublicTables);
router.get('/table/:tenantSlug/:tableId', public_controller_1.getTableInfo);
router.post('/order/:tenantSlug/:tableId', public_controller_1.createPublicOrder);
router.post('/online-order/:tenantSlug', public_controller_1.createOnlineOrder);
router.post('/loyalty/identify/:tenantSlug', public_controller_1.identifyLoyaltyCustomer);
exports.default = router;
//# sourceMappingURL=public.routes.js.map