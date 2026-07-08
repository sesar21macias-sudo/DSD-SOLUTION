import { Response } from 'express'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { sendError } from '../../utils/sendError'

export async function getCurrentShift(req: AuthRequest, res: Response): Promise<void> {
  const { data } = await supabase
    .from('shifts')
    .select('*, users!opened_by(full_name)')
    .eq('tenant_id', req.user!.tenantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .single()

  res.json({ success: true, data: data ?? null })
}

export async function openShift(req: AuthRequest, res: Response): Promise<void> {
  const { opening_amount, notes } = z.object({
    opening_amount: z.number().min(0).default(0),
    notes: z.string().optional(),
  }).parse(req.body)

  const { data: existing } = await supabase
    .from('shifts')
    .select('id')
    .eq('tenant_id', req.user!.tenantId)
    .eq('status', 'open')
    .single()

  if (existing) {
    res.status(400).json({ success: false, error: 'Ya hay un turno abierto' }); return
  }

  const { data, error } = await supabase
    .from('shifts')
    .insert({ tenant_id: req.user!.tenantId, opened_by: req.user!.userId, opening_amount, notes })
    .select()
    .single()

  if (error) { sendError(res, 500, error); return }
  res.status(201).json({ success: true, data })
}

export async function closeShift(req: AuthRequest, res: Response): Promise<void> {
  const { closing_amount, notes } = z.object({
    closing_amount: z.number().min(0),
    notes: z.string().optional(),
  }).parse(req.body)

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, opening_amount, opened_at')
    .eq('tenant_id', req.user!.tenantId)
    .eq('status', 'open')
    .single()

  if (!shift) { res.status(404).json({ success: false, error: 'No hay turno abierto' }); return }

  // Calcular total de ventas en efectivo durante el turno
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', req.user!.tenantId)
    .eq('method', 'cash')
    .eq('status', 'completed')
    .gte('created_at', shift.opened_at)

  const cashSales = payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0
  const expected = Number(shift.opening_amount) + cashSales
  const difference = closing_amount - expected

  const { data, error } = await supabase
    .from('shifts')
    .update({
      closed_by: req.user!.userId,
      closing_amount,
      expected_amount: expected,
      difference,
      notes,
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', shift.id)
    .select()
    .single()

  if (error) { sendError(res, 500, error); return }
  res.json({ success: true, data: { ...data, cash_sales: cashSales } })
}
