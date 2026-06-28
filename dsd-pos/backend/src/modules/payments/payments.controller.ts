import { Response } from 'express'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { io } from '../../server'

const paymentSchema = z.object({
  order_id: z.string().uuid(),
  method: z.enum(['cash', 'card', 'transfer']),
  cash_received: z.number().positive().optional(),
})

export async function processPayment(req: AuthRequest, res: Response): Promise<void> {
  const parsed = paymentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return
  }

  const { order_id, method, cash_received } = parsed.data

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, total, currency, status, tenant_id')
    .eq('id', order_id)
    .eq('tenant_id', req.user!.tenantId)
    .single()

  if (orderError || !order) {
    res.status(404).json({ success: false, error: 'Orden no encontrada' }); return
  }

  if (order.status === 'paid') {
    res.status(400).json({ success: false, error: 'La orden ya fue pagada' }); return
  }

  if (order.status === 'cancelled') {
    res.status(400).json({ success: false, error: 'No se puede cobrar una orden cancelada' }); return
  }

  const change = method === 'cash' && cash_received ? cash_received - order.total : 0

  if (method === 'cash' && cash_received && cash_received < order.total) {
    res.status(400).json({ success: false, error: `Monto insuficiente. Faltan $${(order.total - cash_received).toFixed(2)}` }); return
  }

  const { data: payment, error: payError } = await supabase
    .from('payments')
    .insert({
      tenant_id: req.user!.tenantId,
      order_id,
      amount: order.total,
      currency: order.currency,
      method,
      status: 'completed',
      cash_received: cash_received ?? null,
      change_given: change > 0 ? change : null,
      processed_by: req.user!.userId,
    })
    .select()
    .single()

  if (payError) {
    res.status(500).json({ success: false, error: payError.message }); return
  }

  // El pago queda registrado pero la orden sigue el flujo de cocina
  // Se marca como 'paid' solo cuando cocina la entrega
  io.to(`tenant:${req.user!.tenantId}`).emit('order:paid', { order_id, payment })

  res.status(201).json({
    success: true,
    data: { payment, change: change > 0 ? change : 0 },
  })
}

export async function getOrderPayments(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', req.params['orderId'])
    .eq('tenant_id', req.user!.tenantId)

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}
