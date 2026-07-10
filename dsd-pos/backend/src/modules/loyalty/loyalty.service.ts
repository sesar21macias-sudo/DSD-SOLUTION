import { supabase } from '../../config/supabase'

const POINTS_PER_CURRENCY_UNIT = 1 / 10 // 1 punto por cada $10 gastados

function tierForSpend(totalSpent: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (totalSpent >= 5000) return 'platinum'
  if (totalSpent >= 2000) return 'gold'
  if (totalSpent >= 500) return 'silver'
  return 'bronze'
}

// Se llama al completar un pago (efectivo/tarjeta en POS o webhook de Mercado Pago).
// No lanza: un fallo aquí nunca debe romper el flujo de cobro.
export async function accrueLoyaltyPoints(params: {
  tenantId: string
  customerPhone?: string | null
  amountSpent: number
  orderId: string
}): Promise<void> {
  const { tenantId, customerPhone, amountSpent, orderId } = params
  if (!customerPhone || amountSpent <= 0) return

  try {
    const pointsEarned = Math.floor(amountSpent * POINTS_PER_CURRENCY_UNIT)
    if (pointsEarned <= 0) return

    // Normalize phone: strip all non-digits (handles +52..., +1..., bare 10-digit)
    const normalizedPhone = customerPhone.replace(/\D/g, '')

    // Try normalized phone first, then fallback to last 10 digits for legacy data
    let { data: existing } = await supabase
      .from('loyalty_customers')
      .select('id, points, total_visits, total_spent, phone')
      .eq('tenant_id', tenantId)
      .eq('phone', normalizedPhone)
      .maybeSingle()

    // Fallback: match by last 10 digits (legacy records stored without country code)
    if (!existing && normalizedPhone.length > 10) {
      const last10 = normalizedPhone.slice(-10)
      const { data: fallback } = await supabase
        .from('loyalty_customers')
        .select('id, points, total_visits, total_spent, phone')
        .eq('tenant_id', tenantId)
        .eq('phone', last10)
        .maybeSingle()
      if (fallback) {
        existing = fallback
        // Update stored phone to normalized format for future consistency
        await supabase.from('loyalty_customers')
          .update({ phone: normalizedPhone })
          .eq('id', fallback.id)
      }
    }

    // Use normalized phone going forward
    const phoneToUse = normalizedPhone

    const newTotalSpent = Number(existing?.total_spent ?? 0) + amountSpent
    const newPoints = (existing?.points ?? 0) + pointsEarned
    const tier = tierForSpend(newTotalSpent)

    const { data: customer, error } = await supabase
      .from('loyalty_customers')
      .upsert({
        tenant_id: tenantId,
        phone: phoneToUse,
        points: newPoints,
        total_visits: (existing?.total_visits ?? 0) + 1,
        total_spent: newTotalSpent,
        tier,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,phone' })
      .select('id')
      .single()

    if (error || !customer) { console.error('[Loyalty] Error actualizando cliente:', error?.message); return }

    await supabase.from('loyalty_transactions').insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      order_id: orderId,
      points_earned: pointsEarned,
      description: `Puntos por compra de $${amountSpent.toFixed(2)}`,
    })
  } catch (err) {
    console.error('[Loyalty] Error acumulando puntos:', err)
  }
}
