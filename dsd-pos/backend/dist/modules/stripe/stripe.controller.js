"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentIntent = createPaymentIntent;
exports.confirmStripePayment = confirmStripePayment;
const zod_1 = require("zod");
const stripe_1 = __importDefault(require("stripe"));
const supabase_1 = require("../../config/supabase");
const server_1 = require("../../server");
function stripeClient() {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key)
        throw new Error('STRIPE_SECRET_KEY not configured');
    return new stripe_1.default(key);
}
// ── POST /api/stripe/payment-intent ──────────────────────────────────────────
async function createPaymentIntent(req, res) {
    const schema = zod_1.z.object({
        order_id: zod_1.z.string().uuid(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { order_id } = parsed.data;
    const { data: order } = await supabase_1.supabase
        .from('orders')
        .select('id, order_number, total, currency, status, tenant_id, table_id, tenants(name)')
        .eq('id', order_id)
        .single();
    if (!order) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    if (order.status === 'paid') {
        res.status(400).json({ success: false, error: 'Esta orden ya fue pagada' });
        return;
    }
    const stripe = stripeClient();
    const amountCents = Math.round(Number(order.total) * 100);
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: (order.currency ?? 'mxn').toLowerCase(),
        metadata: { order_id, order_number: order.order_number },
        automatic_payment_methods: { enabled: true },
        description: `Orden ${order.order_number}`,
    });
    res.json({
        success: true,
        data: {
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
            publishable_key: process.env['STRIPE_PUBLISHABLE_KEY'] ?? '',
        },
    });
}
// ── POST /api/stripe/confirm-payment ─────────────────────────────────────────
// Confirma el pago y marca la orden como pagada
async function confirmStripePayment(req, res) {
    const schema = zod_1.z.object({
        payment_intent_id: zod_1.z.string(),
        order_id: zod_1.z.string().uuid(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { payment_intent_id, order_id } = parsed.data;
    const stripe = stripeClient();
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (intent.status !== 'succeeded') {
        res.status(400).json({ success: false, error: `Pago no completado: ${intent.status}` });
        return;
    }
    // Load order to get its current status
    const { data: orderBefore } = await supabase_1.supabase
        .from('orders')
        .select('id, order_number, tenant_id, table_id, total, status, order_items(id, quantity, unit_price, subtotal, product_id)')
        .eq('id', order_id)
        .single();
    if (!orderBefore) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    if (orderBefore.status === 'paid') {
        res.json({ success: true, data: { order_number: orderBefore.order_number } });
        return;
    }
    const wasPendingPayment = orderBefore.status === 'pending_payment';
    const { data: order } = await supabase_1.supabase
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', order_id)
        .select('id, order_number, tenant_id, table_id, total')
        .single();
    if (!order) {
        res.status(500).json({ success: false, error: 'Error actualizando orden' });
        return;
    }
    await supabase_1.supabase.from('payments').insert({
        tenant_id: order.tenant_id,
        order_id,
        amount: order.total,
        currency: 'MXN',
        method: 'card',
        status: 'completed',
        mp_payment_id: payment_intent_id,
    });
    if (order.table_id) {
        await supabase_1.supabase.from('tables')
            .update({ status: 'available', updated_at: new Date().toISOString() })
            .eq('id', order.table_id);
    }
    if (wasPendingPayment) {
        server_1.io.to(`tenant:${order.tenant_id}`).emit('order:new', {
            ...orderBefore,
            status: 'paid',
            source: 'web',
        });
    }
    server_1.io.to(`tenant:${order.tenant_id}`).emit('order:paid', {
        order_id,
        order_number: order.order_number,
        table_id: order.table_id,
    });
    res.json({ success: true, data: { order_number: order.order_number } });
}
//# sourceMappingURL=stripe.controller.js.map