import { Response } from 'express'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { sendError } from '../../utils/sendError'

export async function getReservations(req: AuthRequest, res: Response): Promise<void> {
  const { date, status } = req.query

  let query = supabase
    .from('reservations')
    .select('*, tables(number, name)')
    .eq('tenant_id', req.user!.tenantId)
    .order('reservation_time', { ascending: true })

  if (date) {
    const start = new Date(date as string); start.setHours(0, 0, 0, 0)
    const end = new Date(date as string); end.setHours(23, 59, 59, 999)
    query = query.gte('reservation_time', start.toISOString()).lte('reservation_time', end.toISOString())
  }
  if (status) query = query.eq('status', status as string)

  const { data, error } = await query
  if (error) { sendError(res, 500, error, 'No se pudieron obtener las reservaciones'); return }
  res.json({ success: true, data })
}

const createSchema = z.object({
  table_id: z.string().uuid().optional(),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  party_size: z.number().int().positive().default(2),
  reservation_time: z.string().datetime({ offset: true }).or(z.string().min(1)),
  notes: z.string().optional(),
})

export async function createReservation(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  if (parsed.data.table_id) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('id', parsed.data.table_id)
      .eq('tenant_id', req.user!.tenantId)
      .maybeSingle()
    if (!table) { res.status(400).json({ success: false, error: 'Mesa inválida' }); return }
  }

  const { data, error } = await supabase
    .from('reservations')
    .insert({ ...parsed.data, tenant_id: req.user!.tenantId, created_by: req.user!.userId })
    .select('*, tables(number, name)')
    .single()

  if (error) { sendError(res, 500, error, 'No se pudo crear la reservación'); return }
  res.status(201).json({ success: true, data })
}

const updateSchema = z.object({
  status: z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no_show']).optional(),
  table_id: z.string().uuid().optional(),
  reservation_time: z.string().min(1).optional(),
  party_size: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export async function updateReservation(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('reservations')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .select('*, tables(number, name)')
    .single()

  if (error || !data) { res.status(404).json({ success: false, error: 'Reservación no encontrada' }); return }
  res.json({ success: true, data })
}
