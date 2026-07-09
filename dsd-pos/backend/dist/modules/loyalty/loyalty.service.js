"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accrueLoyaltyPoints = accrueLoyaltyPoints;
const supabase_1 = require("../../config/supabase");
const POINTS_PER_CURRENCY_UNIT = 1 / 10; // 1 punto por cada $10 gastados
function tierForSpend(totalSpent) {
    if (totalSpent >= 5000)
        return 'platinum';
    if (totalSpent >= 2000)
        return 'gold';
    if (totalSpent >= 500)
        return 'silver';
    return 'bronze';
}
// Se llama al completar un pago (efectivo/tarjeta en POS o webhook de Mercado Pago).
// No lanza: un fallo aquí nunca debe romper el flujo de cobro.
async function accrueLoyaltyPoints(params) {
    const { tenantId, customerPhone, amountSpent, orderId } = params;
    if (!customerPhone || amountSpent <= 0)
        return;
    try {
        const pointsEarned = Math.floor(amountSpent * POINTS_PER_CURRENCY_UNIT);
        if (pointsEarned <= 0)
            return;
        const { data: existing } = await supabase_1.supabase
            .from('loyalty_customers')
            .select('id, points, total_visits, total_spent')
            .eq('tenant_id', tenantId)
            .eq('phone', customerPhone)
            .maybeSingle();
        const newTotalSpent = Number(existing?.total_spent ?? 0) + amountSpent;
        const newPoints = (existing?.points ?? 0) + pointsEarned;
        const tier = tierForSpend(newTotalSpent);
        const { data: customer, error } = await supabase_1.supabase
            .from('loyalty_customers')
            .upsert({
            tenant_id: tenantId,
            phone: customerPhone,
            points: newPoints,
            total_visits: (existing?.total_visits ?? 0) + 1,
            total_spent: newTotalSpent,
            tier,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,phone' })
            .select('id')
            .single();
        if (error || !customer) {
            console.error('[Loyalty] Error actualizando cliente:', error?.message);
            return;
        }
        await supabase_1.supabase.from('loyalty_transactions').insert({
            tenant_id: tenantId,
            customer_id: customer.id,
            order_id: orderId,
            points_earned: pointsEarned,
            description: `Puntos por compra de $${amountSpent.toFixed(2)}`,
        });
    }
    catch (err) {
        console.error('[Loyalty] Error acumulando puntos:', err);
    }
}
//# sourceMappingURL=loyalty.service.js.map