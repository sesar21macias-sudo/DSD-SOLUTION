"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.upsertSettings = upsertSettings;
exports.regenerateSecret = regenerateSecret;
exports.receiveWebhook = receiveWebhook;
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const supabase_1 = require("../../config/supabase");
const server_1 = require("../../server");
const sendError_1 = require("../../utils/sendError");
// ── Configuración (autenticado, panel de admin) ────────────────────────────────
async function getSettings(req, res) {
    const { data } = await supabase_1.supabase
        .from('delivery_integrations')
        .select('id, provider, is_active, webhook_secret, created_at')
        .eq('tenant_id', req.user.tenantId)
        .maybeSingle();
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('slug').eq('id', req.user.tenantId).single();
    res.json({
        success: true,
        data: {
            integration: data ?? null,
            webhook_url: tenant ? `${process.env['BACKEND_URL'] ?? 'http://localhost:4000'}/api/delivery/webhook/${tenant.slug}` : null,
        },
    });
}
const upsertSchema = zod_1.z.object({
    provider: zod_1.z.enum(['chowly', 'otter', 'deliverect', 'other']).default('other'),
    is_active: zod_1.z.boolean().default(true),
});
async function upsertSettings(req, res) {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data: existing } = await supabase_1.supabase
        .from('delivery_integrations')
        .select('id, webhook_secret')
        .eq('tenant_id', req.user.tenantId)
        .maybeSingle();
    const { data, error } = await supabase_1.supabase
        .from('delivery_integrations')
        .upsert({
        tenant_id: req.user.tenantId,
        provider: parsed.data.provider,
        is_active: parsed.data.is_active,
        webhook_secret: existing?.webhook_secret ?? crypto_1.default.randomBytes(24).toString('hex'),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo guardar la configuración');
        return;
    }
    res.json({ success: true, data });
}
async function regenerateSecret(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('delivery_integrations')
        .update({ webhook_secret: crypto_1.default.randomBytes(24).toString('hex'), updated_at: new Date().toISOString() })
        .eq('tenant_id', req.user.tenantId)
        .select()
        .single();
    if (error || !data) {
        res.status(404).json({ success: false, error: 'No hay integración configurada todavía' });
        return;
    }
    res.json({ success: true, data });
}
// ── Webhook público (llamado por el agregador) ─────────────────────────────────
//
// Payload normalizado esperado (varía por agregador real — Chowly/Otter/Deliverect
// exponen formatos ligeramente distintos; este es el contrato mínimo común que
// asumimos aquí, y habría que adaptarlo al proveedor real elegido):
// {
//   "external_order_id": "string",
//   "provider": "ubereats" | "doordash" | "grubhub" | "other",
//   "customer_name": "string",
//   "customer_phone": "string" (opcional),
//   "currency": "MXN" | "USD",
//   "items": [{ "name": "string", "quantity": 1, "price": 10.5, "notes": "string" (opcional) }]
// }
const webhookItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int().positive(),
    price: zod_1.z.number().nonnegative(),
    notes: zod_1.z.string().optional(),
});
const webhookSchema = zod_1.z.object({
    external_order_id: zod_1.z.string().min(1),
    provider: zod_1.z.string().default('other'),
    customer_name: zod_1.z.string().optional(),
    customer_phone: zod_1.z.string().optional(),
    currency: zod_1.z.enum(['MXN', 'USD']).default('MXN'),
    items: zod_1.z.array(webhookItemSchema).min(1),
});
async function receiveWebhook(req, res) {
    const { tenantSlug } = req.params;
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('id').eq('slug', tenantSlug).eq('is_active', true).single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const { data: integration } = await supabase_1.supabase
        .from('delivery_integrations')
        .select('webhook_secret, is_active')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
    if (!integration || !integration.is_active) {
        res.status(404).json({ success: false, error: 'Integración de delivery no configurada' });
        return;
    }
    const providedSecret = req.headers['x-webhook-secret'];
    if (providedSecret !== integration.webhook_secret) {
        res.status(401).json({ success: false, error: 'Secreto de webhook inválido' });
        return;
    }
    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { external_order_id, provider, customer_name, customer_phone, currency, items } = parsed.data;
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const tax = Math.round(subtotal * 0.16 * 100) / 100;
    const total = subtotal + tax;
    const orderNumber = `DLV-${Date.now().toString(36).toUpperCase()}`;
    const { data: order, error: orderError } = await supabase_1.supabase
        .from('orders')
        .insert({
        tenant_id: tenant.id,
        order_number: orderNumber,
        type: 'delivery',
        status: 'pending',
        customer_name: customer_name ?? `Pedido ${provider}`,
        customer_phone,
        notes: `${provider} #${external_order_id}`,
        currency,
        subtotal,
        tax,
        total,
    })
        .select()
        .single();
    if (orderError || !order) {
        (0, sendError_1.sendError)(res, 500, orderError, 'No se pudo crear la orden');
        return;
    }
    // Los items de agregadores no mapean a menu_products (no compartimos catálogo
    // con la plataforma externa) — se guardan como línea libre vía `notes`.
    const orderItems = items.map(i => ({
        id: (0, uuid_1.v4)(),
        order_id: order.id,
        tenant_id: tenant.id,
        product_id: null,
        quantity: i.quantity,
        unit_price: i.price,
        subtotal: i.price * i.quantity,
        notes: i.notes ? `${i.name} — ${i.notes}` : i.name,
    }));
    const { error: itemsError } = await supabase_1.supabase.from('order_items').insert(orderItems);
    if (itemsError) {
        (0, sendError_1.sendError)(res, 500, itemsError, 'No se pudo crear la orden');
        return;
    }
    server_1.io.to(`tenant:${tenant.id}`).emit('order:new', { ...order, order_items: orderItems, source: provider });
    res.status(201).json({ success: true, data: { order_id: order.id, order_number: order.order_number } });
}
//# sourceMappingURL=delivery.controller.js.map