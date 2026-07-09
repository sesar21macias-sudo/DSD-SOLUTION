"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        const response = { success: false, error: 'Token requerido' };
        res.status(401).json(response);
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env['JWT_SECRET']);
        req.user = payload;
        next();
    }
    catch {
        const response = { success: false, error: 'Token inválido o expirado' };
        res.status(401).json(response);
    }
}
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            const response = { success: false, error: 'No tienes permisos para esta acción' };
            res.status(403).json(response);
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map