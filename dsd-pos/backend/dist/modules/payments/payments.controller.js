"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPayment = processPayment;
exports.getOrderPayments = getOrderPayments;
const zod_1 = require("zod");
const supabase_1 = require("../../config/supabase");
const server_1 = require("../../server");
const loyalty_service_1 = require("../loyalty/loyalty.service");
const sendError_1 = require("../../utils/sendError");
const paymentSchema = zod_1.z.object({
    order_id: zod_1.z.string().uuid(),
    method: zod_1.z.enum(['cash', 'card', 'transfer']),
    cash_received: zod_1.z.number().positive().optional(),
    tip_percent: zod_1.z.number().min(0).max(100).default(0),
    // Monto a cobrar en este pago. Si se omite, cobra el saldo restante completo
    // (comportamiento normal). Si se especifica y es menor al saldo, es un pago
    // parcial — base de "dividir cuenta": varios pagos contra la misma orden
    // hasta cubrir el total.
    amount: zod_1.z.number().positive().optional(),
});
async function processPayment(req, res) {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { order_id, method, cash_received, tip_percent, amount } = parsed.data;
    const { data: order, error: orderError } = await supabase_1.supabase
        .from('orders')
        .select('id, subtotal, total, currency, status, tenant_id, customer_phone')
        .eq('id', order_id)
        .eq('tenant_id', req.user.tenantId)
        .single();
    if (orderError || !order) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    if (order.status === 'paid') {
        res.status(400).json({ success: false, error: 'La orden ya fue pagada' });
        return;
    }
    if (order.status === 'cancelled') {
        res.status(400).json({ success: false, error: 'No se puede cobrar una orden cancelada' });
        return;
    }
    const { data: existingPayments } = await supabase_1.supabase
        .from('payments')
        .select('amount')
        .eq('order_id', order_id)
        .eq('status', 'completed');
    const alreadyPaid = (existingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const isFirstPayment = (existingPayments ?? []).length === 0;
    // La propina se calcula y se fija al total solo en el primer pago de la orden;
    // los pagos parciales subsecuentes (dividir cuenta) ya ven el total con propina incluida.
    const tipAmount = isFirstPayment ? Math.round(Number(order.subtotal) * (tip_percent / 100) * 100) / 100 : 0;
    const totalWithTip = isFirstPayment ? Number(order.total) + tipAmount : Number(order.total);
    const remainingBalance = Math.round((totalWithTip - alreadyPaid) * 100) / 100;
    if (remainingBalance <= 0.005) {
        res.status(400).json({ success: false, error: 'Esta orden ya fue cubierta por completo' });
        return;
    }
    const amountToCharge = amount !== undefined ? Math.round(amount * 100) / 100 : remainingBalance;
    if (amountToCharge > remainingBalance + 0.01) {
        res.status(400).json({ success: false, error: `El monto excede el saldo pendiente ($${remainingBalance.toFixed(2)})` });
        return;
    }
    const change = method === 'cash' && cash_received ? cash_received - amountToCharge : 0;
    if (method === 'cash' && cash_received && cash_received < amountToCharge) {
        res.status(400).json({ success: false, error: `Monto insuficiente. Faltan $${(amountToCharge - cash_received).toFixed(2)}` });
        return;
    }
    const { data: payment, error: payError } = await supabase_1.supabase
        .from('payments')
        .insert({
        tenant_id: req.user.tenantId,
        order_id,
        amount: amountToCharge,
        currency: order.currency,
        method,
        status: 'completed',
        cash_received: cash_received ?? null,
        change_given: change > 0 ? change : null,
        processed_by: req.user.userId,
    })
        .select()
        .single();
    if (payError) {
        (0, sendError_1.sendError)(res, 500, payError, 'No se pudo procesar el pago');
        return;
    }
    if (tipAmount > 0) {
        await supabase_1.supabase.from('orders').update({
            tip_amount: tipAmount,
            tip_percent,
            total: totalWithTip,
            updated_at: new Date().toISOString(),
        }).eq('id', order_id);
    }
    (0, loyalty_service_1.accrueLoyaltyPoints)({
        tenantId: req.user.tenantId,
        customerPhone: order.customer_phone,
        amountSpent: amountToCharge,
        orderId: order_id,
    }).catch(err => console.error('[Loyalty] Error acumulando puntos:', err));
    const newRemaining = Math.max(0, Math.round((remainingBalance - amountToCharge) * 100) / 100);
    const fullyPaid = newRemaining <= 0.005;
    // El pago queda registrado pero la orden sigue el flujo de cocina
    // Se marca como 'paid' solo cuando cocina la entrega
    server_1.io.to(`tenant:${req.user.tenantId}`).emit('order:paid', { order_id, payment, fully_paid: fullyPaid });
    res.status(201).json({
        success: true,
        data: { payment, change: change > 0 ? change : 0, total: totalWithTip, remaining_balance: newRemaining, fully_paid: fullyPaid },
    });
}
async function getOrderPayments(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('payments')
        .select('*')
        .eq('order_id', req.params['orderId'])
        .eq('tenant_id', req.user.tenantId);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
//# sourceMappingURL=payments.controller.js.map