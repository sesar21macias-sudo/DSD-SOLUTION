interface Message {
    role: 'user' | 'assistant';
    content: string;
}
export interface AgentResult {
    reply: string;
    newOrder?: {
        order_id: string;
        order_number: string;
        total: number;
        tenant_id: string;
        order_items: unknown[];
    };
}
export declare function processWhatsAppMessage(tenantId: string, tenantName: string, phone: string, customerMessage: string, history: Message[]): Promise<AgentResult>;
export {};
//# sourceMappingURL=whatsapp.agent.d.ts.map