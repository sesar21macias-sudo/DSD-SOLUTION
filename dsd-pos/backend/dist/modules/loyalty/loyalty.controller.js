"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomers = listCustomers;
exports.getCustomerByPhone = getCustomerByPhone;
exports.listRewards = listRewards;
exports.createReward = createReward;
exports.updateReward = updateReward;
exports.deleteReward = deleteReward;
exports.redeemReward = redeemReward;
const zod_1 = require("zod");
const supabase_1 = require("../../config/supabase");
const sendError_1 = require("../../utils/sendError");
// ── Clientes ──────────────────────────────────────────────────────────────────
async function listCustomers(req, res) {
    const { search } = req.query;
    let query = supabase_1.supabase
        .from('loyalty_customers')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .order('total_spent', { ascending: false });
    if (search)
        query = query.or(`phone.ilike.%${search}%,full_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo obtener la lista de clientes');
        return;
    }
    res.json({ success: true, data });
}
async function getCustomerByPhone(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('loyalty_customers')
        .select('*, loyalty_transactions(id, points_earned, points_redeemed, description, created_at)')
        .eq('tenant_id', req.user.tenantId)
        .eq('phone', req.params['phone'])
        .maybeSingle();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo obtener el cliente');
        return;
    }
    if (!data) {
        res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        return;
    }
    res.json({ success: true, data });
}
// ── Recompensas ───────────────────────────────────────────────────────────────
const rewardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    points_required: zod_1.z.number().int().positive(),
    reward_type: zod_1.z.enum(['discount', 'free_item', 'percentage']),
    reward_value: zod_1.z.number().positive().optional(),
    product_id: zod_1.z.string().uuid().optional(),
});
async function listRewards(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true)
        .order('points_required');
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo obtener la lista de recompensas');
        return;
    }
    res.json({ success: true, data });
}
async function createReward(req, res) {
    const parsed = rewardSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('loyalty_rewards')
        .insert({ ...parsed.data, tenant_id: req.user.tenantId })
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo crear la recompensa');
        return;
    }
    res.status(201).json({ success: true, data });
}
async function updateReward(req, res) {
    const parsed = rewardSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('loyalty_rewards')
        .update(parsed.data)
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo actualizar la recompensa');
        return;
    }
    res.json({ success: true, data });
}
async function deleteReward(req, res) {
    const { error } = await supabase_1.supabase
        .from('loyalty_rewards')
        .update({ is_active: false })
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo eliminar la recompensa');
        return;
    }
    res.json({ success: true, message: 'Recompensa eliminada' });
}
// ── Canje ─────────────────────────────────────────────────────────────────────
const redeemSchema = zod_1.z.object({
    phone: zod_1.z.string().min(1),
    reward_id: zod_1.z.string().uuid(),
});
async function redeemReward(req, res) {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { phone, reward_id } = parsed.data;
    const { data: customer } = await supabase_1.supabase
        .from('loyalty_customers')
        .select('id, points')
        .eq('tenant_id', req.user.tenantId)
        .eq('phone', phone)
        .maybeSingle();
    if (!customer) {
        res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        return;
    }
    const { data: reward } = await supabase_1.supabase
        .from('loyalty_rewards')
        .select('id, name, points_required')
        .eq('id', reward_id)
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true)
        .maybeSingle();
    if (!reward) {
        res.status(404).json({ success: false, error: 'Recompensa no encontrada' });
        return;
    }
    if (customer.points < reward.points_required) {
        res.status(400).json({ success: false, error: `Puntos insuficientes. Faltan ${reward.points_required - customer.points} puntos` });
        return;
    }
    const newPoints = customer.points - reward.points_required;
    const { error: updateErr } = await supabase_1.supabase
        .from('loyalty_customers')
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq('id', customer.id);
    if (updateErr) {
        (0, sendError_1.sendError)(res, 500, updateErr, 'No se pudo canjear la recompensa');
        return;
    }
    await supabase_1.supabase.from('loyalty_transactions').insert({
        tenant_id: req.user.tenantId,
        customer_id: customer.id,
        points_redeemed: reward.points_required,
        description: `Canje: ${reward.name}`,
    });
    res.json({ success: true, data: { remaining_points: newPoints, reward: reward.name } });
}
//# sourceMappingURL=loyalty.controller.js.map