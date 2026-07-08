import { Response } from 'express'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { sendError } from '../../utils/sendError'

// ── Clientes ──────────────────────────────────────────────────────────────────

export async function listCustomers(req: AuthRequest, res: Response): Promise<void> {
  const { search } = req.query
  let query = supabase
    .from('loyalty_customers')
    .select('*')
    .eq('tenant_id', req.user!.tenantId)
    .order('total_spent', { ascending: false })

  if (search) query = query.or(`phone.ilike.%${search}%,full_name.ilike.%${search}%`)

  const { data, error } = await query
  if (error) { sendError(res, 500, error, 'No se pudo obtener la lista de clientes'); return }
  res.json({ success: true, data })
}

export async function getCustomerByPhone(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('loyalty_customers')
    .select('*, loyalty_transactions(id, points_earned, points_redeemed, description, created_at)')
    .eq('tenant_id', req.user!.tenantId)
    .eq('phone', req.params['phone'])
    .maybeSingle()

  if (error) { sendError(res, 500, error, 'No se pudo obtener el cliente'); return }
  if (!data) { res.status(404).json({ success: false, error: 'Cliente no encontrado' }); return }
  res.json({ success: true, data })
}

// ── Recompensas ───────────────────────────────────────────────────────────────

const rewardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  points_required: z.number().int().positive(),
  reward_type: z.enum(['discount', 'free_item', 'percentage']),
  reward_value: z.number().positive().optional(),
  product_id: z.string().uuid().optional(),
})

export async function listRewards(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .eq('tenant_id', req.user!.tenantId)
    .eq('is_active', true)
    .order('points_required')

  if (error) { sendError(res, 500, error, 'No se pudo obtener la lista de recompensas'); return }
  res.json({ success: true, data })
}

export async function createReward(req: AuthRequest, res: Response): Promise<void> {
  const parsed = rewardSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('loyalty_rewards')
    .insert({ ...parsed.data, tenant_id: req.user!.tenantId })
    .select()
    .single()

  if (error) { sendError(res, 500, error, 'No se pudo crear la recompensa'); return }
  res.status(201).json({ success: true, data })
}

export async function updateReward(req: AuthRequest, res: Response): Promise<void> {
  const parsed = rewardSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('loyalty_rewards')
    .update(parsed.data)
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .select()
    .single()

  if (error) { sendError(res, 500, error, 'No se pudo actualizar la recompensa'); return }
  res.json({ success: true, data })
}

export async function deleteReward(req: AuthRequest, res: Response): Promise<void> {
  const { error } = await supabase
    .from('loyalty_rewards')
    .update({ is_active: false })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)

  if (error) { sendError(res, 500, error, 'No se pudo eliminar la recompensa'); return }
  res.json({ success: true, message: 'Recompensa eliminada' })
}

// ── Canje ─────────────────────────────────────────────────────────────────────

const redeemSchema = z.object({
  phone: z.string().min(1),
  reward_id: z.string().uuid(),
})

export async function redeemReward(req: AuthRequest, res: Response): Promise<void> {
  const parsed = redeemSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { phone, reward_id } = parsed.data

  const { data: customer } = await supabase
    .from('loyalty_customers')
    .select('id, points')
    .eq('tenant_id', req.user!.tenantId)
    .eq('phone', phone)
    .maybeSingle()

  if (!customer) { res.status(404).json({ success: false, error: 'Cliente no encontrado' }); return }

  const { data: reward } = await supabase
    .from('loyalty_rewards')
    .select('id, name, points_required')
    .eq('id', reward_id)
    .eq('tenant_id', req.user!.tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (!reward) { res.status(404).json({ success: false, error: 'Recompensa no encontrada' }); return }

  if (customer.points < reward.points_required) {
    res.status(400).json({ success: false, error: `Puntos insuficientes. Faltan ${reward.points_required - customer.points} puntos` })
    return
  }

  const newPoints = customer.points - reward.points_required
  const { error: updateErr } = await supabase
    .from('loyalty_customers')
    .update({ points: newPoints, updated_at: new Date().toISOString() })
    .eq('id', customer.id)

  if (updateErr) { sendError(res, 500, updateErr, 'No se pudo canjear la recompensa'); return }

  await supabase.from('loyalty_transactions').insert({
    tenant_id: req.user!.tenantId,
    customer_id: customer.id,
    points_redeemed: reward.points_required,
    description: `Canje: ${reward.name}`,
  })

  res.json({ success: true, data: { remaining_points: newPoints, reward: reward.name } })
}
