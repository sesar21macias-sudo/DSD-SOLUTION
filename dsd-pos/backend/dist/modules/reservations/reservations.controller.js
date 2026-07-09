"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReservations = getReservations;
exports.createReservation = createReservation;
exports.updateReservation = updateReservation;
const zod_1 = require("zod");
const supabase_1 = require("../../config/supabase");
const sendError_1 = require("../../utils/sendError");
async function getReservations(req, res) {
    const { date, status } = req.query;
    let query = supabase_1.supabase
        .from('reservations')
        .select('*, tables(number, name)')
        .eq('tenant_id', req.user.tenantId)
        .order('reservation_time', { ascending: true });
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        query = query.gte('reservation_time', start.toISOString()).lte('reservation_time', end.toISOString());
    }
    if (status)
        query = query.eq('status', status);
    const { data, error } = await query;
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudieron obtener las reservaciones');
        return;
    }
    res.json({ success: true, data });
}
const createSchema = zod_1.z.object({
    table_id: zod_1.z.string().uuid().optional(),
    customer_name: zod_1.z.string().min(1),
    customer_phone: zod_1.z.string().optional(),
    party_size: zod_1.z.number().int().positive().default(2),
    reservation_time: zod_1.z.string().datetime({ offset: true }).or(zod_1.z.string().min(1)),
    notes: zod_1.z.string().optional(),
});
async function createReservation(req, res) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    if (parsed.data.table_id) {
        const { data: table } = await supabase_1.supabase
            .from('tables')
            .select('id')
            .eq('id', parsed.data.table_id)
            .eq('tenant_id', req.user.tenantId)
            .maybeSingle();
        if (!table) {
            res.status(400).json({ success: false, error: 'Mesa inválida' });
            return;
        }
    }
    const { data, error } = await supabase_1.supabase
        .from('reservations')
        .insert({ ...parsed.data, tenant_id: req.user.tenantId, created_by: req.user.userId })
        .select('*, tables(number, name)')
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo crear la reservación');
        return;
    }
    res.status(201).json({ success: true, data });
}
const updateSchema = zod_1.z.object({
    status: zod_1.z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no_show']).optional(),
    table_id: zod_1.z.string().uuid().optional(),
    reservation_time: zod_1.z.string().min(1).optional(),
    party_size: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().optional(),
});
async function updateReservation(req, res) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('reservations')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .select('*, tables(number, name)')
        .single();
    if (error || !data) {
        res.status(404).json({ success: false, error: 'Reservación no encontrada' });
        return;
    }
    res.json({ success: true, data });
}
//# sourceMappingURL=reservations.controller.js.map