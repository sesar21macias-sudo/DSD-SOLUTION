interface AuditLogParams {
    tenantId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string | undefined;
    metadata?: Record<string, unknown>;
}
export declare function logAudit(params: AuditLogParams): Promise<void>;
export {};
//# sourceMappingURL=auditLog.d.ts.map