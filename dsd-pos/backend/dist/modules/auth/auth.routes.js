"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const router = (0, express_1.Router)();
router.post('/login', rateLimit_1.loginLimiter, auth_controller_1.login);
router.post('/signup', rateLimit_1.signupLimiter, auth_controller_1.signup);
router.get('/me', auth_1.authenticate, auth_controller_1.me);
router.post('/refresh', auth_1.authenticate, auth_controller_1.refreshToken);
router.get('/users', auth_1.authenticate, (0, auth_1.authorize)('tenant_admin', 'manager'), auth_controller_1.listUsers);
router.post('/users', auth_1.authenticate, (0, auth_1.authorize)('tenant_admin', 'manager'), auth_controller_1.createUser);
router.patch('/users/:id', auth_1.authenticate, (0, auth_1.authorize)('tenant_admin', 'manager'), auth_controller_1.updateUser);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map