"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFound = notFound;
function errorHandler(err, _req, res, _next) {
    console.error('[Error]', err.message, err.stack);
    const response = {
        success: false,
        error: process.env['NODE_ENV'] === 'production' ? 'Error interno del servidor' : err.message,
    };
    res.status(500).json(response);
}
function notFound(_req, res) {
    const response = { success: false, error: 'Ruta no encontrada' };
    res.status(404).json(response);
}
//# sourceMappingURL=errorHandler.js.map