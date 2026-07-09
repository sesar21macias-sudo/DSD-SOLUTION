"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = sendError;
const isProd = () => process.env['NODE_ENV'] === 'production';
// Mapea errores de Supabase/MercadoPago/JWT a un mensaje genérico en producción
// (esos mensajes pueden filtrar nombres de columnas, constraints o detalles de
// la cuenta del comercio). En desarrollo se muestra el mensaje real para debug.
function sendError(res, status, err, fallback = 'Error interno del servidor') {
    // Los errores de Supabase (PostgrestError) son objetos planos con `.message`,
    // no instancias de Error — hay que leerlos explícitamente o el mensaje real
    // se pierde como "[object Object]".
    const rawMessage = err instanceof Error ? err.message :
        (typeof err === 'object' && err !== null && 'message' in err) ? String(err.message) :
            String(err);
    console.error(`[Error ${status}]`, rawMessage);
    const safeMessage = isProd() ? fallback : rawMessage;
    res.status(status).json({ success: false, error: safeMessage });
}
//# sourceMappingURL=sendError.js.map