"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupLimiter = exports.paymentLimiter = exports.loginLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Demasiados intentos, intenta más tarde' },
});
exports.paymentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Demasiadas solicitudes de pago, intenta más tarde' },
});
// Crear un tenant es una acción pública y de un solo uso por negocio — más
// restrictivo que login para frenar registros masivos automatizados.
exports.signupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Demasiados registros desde esta red, intenta más tarde' },
});
//# sourceMappingURL=rateLimit.js.map