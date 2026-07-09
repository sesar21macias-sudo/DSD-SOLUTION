"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reservations_controller_1 = require("./reservations.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', reservations_controller_1.getReservations);
router.post('/', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier', 'waiter'), reservations_controller_1.createReservation);
router.patch('/:id', (0, auth_1.authorize)('tenant_admin', 'manager', 'cashier', 'waiter'), reservations_controller_1.updateReservation);
exports.default = router;
//# sourceMappingURL=reservations.routes.js.map