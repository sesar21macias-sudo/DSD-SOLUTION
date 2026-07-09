"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentShift = getCurrentShift;
exports.openShift = openShift;
exports.closeShift = closeShift;
const zod_1 = require("zod");
const supabase_1 = require("../../config/supabase");
const sendError_1 = require("../../utils/sendError");
async function getCurrentShift(req, res) {
    const { data } = await supabase_1.supabase
        .from('shifts')
        .select('*, users!opened_by(full_name)')
        .eq('tenant_id', req.user.tenantId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();
    res.json({ success: true, data: data ?? null });
}
async function openShift(req, res) {
    const { opening_amount, notes } = zod_1.z.object({
        opening_amount: zod_1.z.number().min(0).default(0),
        notes: zod_1.z.string().optional(),
    }).parse(req.body);
    const { data: existing } = await supabase_1.supabase
        .from('shifts')
        .select('id')
        .eq('tenant_id', req.user.tenantId)
        .eq('status', 'open')
        .single();
    if (existing) {
        res.status(400).json({ success: false, error: 'Ya hay un turno abierto' });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('shifts')
        .insert({ tenant_id: req.user.tenantId, opened_by: req.user.userId, opening_amount, notes })
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.status(201).json({ success: true, data });
}
async function closeShift(req, res) {
    const { closing_amount, notes } = zod_1.z.object({
        closing_amount: zod_1.z.number().min(0),
        notes: zod_1.z.string().optional(),
    }).parse(req.body);
    const { data: shift } = await supabase_1.supabase
        .from('shifts')
        .select('id, opening_amount, opened_at')
        .eq('tenant_id', req.user.tenantId)
        .eq('status', 'open')
        .single();
    if (!shift) {
        res.status(404).json({ success: false, error: 'No hay turno abierto' });
        return;
    }
    // Calcular total de ventas en efectivo durante el turno
    const { data: payments } = await supabase_1.supabase
        .from('payments')
        .select('amount')
        .eq('tenant_id', req.user.tenantId)
        .eq('method', 'cash')
        .eq('status', 'completed')
        .gte('created_at', shift.opened_at);
    const cashSales = payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
    const expected = Number(shift.opening_amount) + cashSales;
    const difference = closing_amount - expected;
    const { data, error } = await supabase_1.supabase
        .from('shifts')
        .update({
        closed_by: req.user.userId,
        closing_amount,
        expected_amount: expected,
        difference,
        notes,
        status: 'closed',
        closed_at: new Date().toISOString(),
    })
        .eq('id', shift.id)
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data: { ...data, cash_sales: cashSales } });
}
//# sourceMappingURL=shift.controller.js.map