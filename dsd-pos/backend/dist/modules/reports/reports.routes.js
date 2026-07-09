"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_controller_1 = require("./reports.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('tenant_admin', 'manager'));
router.get('/daily', reports_controller_1.getDailySummary);
router.get('/top-products', reports_controller_1.getTopProducts);
router.get('/by-hour', reports_controller_1.getSalesByHour);
router.get('/trends', reports_controller_1.getTrends);
router.get('/product-mix', reports_controller_1.getProductMix);
router.get('/margins', reports_controller_1.getMargins);
exports.default = router;
//# sourceMappingURL=reports.routes.js.map