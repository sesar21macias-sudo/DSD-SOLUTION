"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const supabase_1 = require("../config/supabase");
// Fire-and-forget: un fallo al escribir el log nunca debe romper el flujo principal
// (cancelar una orden, cambiar un rol, etc. deben completarse aunque esto falle).
async function logAudit(params) {
    const { error } = await supabase_1.supabase.from('audit_log').insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        metadata: params.metadata ?? {},
    });
    if (error)
        console.error('[AuditLog] Error guardando registro:', error.message);
}
//# sourceMappingURL=auditLog.js.map