import { supabase } from '../config/supabase'

interface AuditLogParams {
  tenantId: string
  userId: string
  action: string
  entityType: string
  entityId?: string | undefined
  metadata?: Record<string, unknown>
}

// Fire-and-forget: un fallo al escribir el log nunca debe romper el flujo principal
// (cancelar una orden, cambiar un rol, etc. deben completarse aunque esto falle).
export async function logAudit(params: AuditLogParams): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    tenant_id: params.tenantId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  })

  if (error) console.error('[AuditLog] Error guardando registro:', error.message)
}
