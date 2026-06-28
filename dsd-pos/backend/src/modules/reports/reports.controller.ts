import { Response } from 'express'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(); end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function getDailySummary(req: AuthRequest, res: Response): Promise<void> {
  const date = req.query['date'] as string | undefined
  let start: string, end: string

  if (date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0); start = d.toISOString()
    d.setHours(23, 59, 59, 999); end = d.toISOString()
  } else {
    ({ start, end } = todayRange())
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, currency, status, type, created_at')
    .eq('tenant_id', req.user!.tenantId)
    .gte('created_at', start)
    .lte('created_at', end)

  if (!orders) { res.json({ success: true, data: {} }); return }

  const paid = orders.filter(o => ['paid', 'delivered'].includes(o.status))
  const cancelled = orders.filter(o => o.status === 'cancelled')

  const totalMXN = paid.filter(o => o.currency === 'MXN').reduce((s, o) => s + Number(o.total), 0)
  const totalUSD = paid.filter(o => o.currency === 'USD').reduce((s, o) => s + Number(o.total), 0)

  const byType = {
    dine_in:  paid.filter(o => o.type === 'dine_in').length,
    takeout:  paid.filter(o => o.type === 'takeout').length,
    delivery: paid.filter(o => o.type === 'delivery').length,
    online:   paid.filter(o => o.type === 'online').length,
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('method, amount')
    .eq('tenant_id', req.user!.tenantId)
    .eq('status', 'completed')
    .gte('created_at', start)
    .lte('created_at', end)

  const byMethod = { cash: 0, card: 0, transfer: 0, online: 0 }
  payments?.forEach(p => { byMethod[p.method as keyof typeof byMethod] += Number(p.amount) })

  res.json({
    success: true,
    data: {
      total_orders: orders.length,
      paid_orders: paid.length,
      cancelled_orders: cancelled.length,
      total_mxn: totalMXN,
      total_usd: totalUSD,
      by_type: byType,
      by_payment_method: byMethod,
      date: date ?? new Date().toISOString().split('T')[0],
    },
  })
}

export async function getTopProducts(req: AuthRequest, res: Response): Promise<void> {
  const { start, end } = todayRange()

  const { data } = await supabase
    .from('order_items')
    .select('product_id, quantity, subtotal, menu_products(name)')
    .eq('tenant_id', req.user!.tenantId)
    .gte('created_at', start)
    .lte('created_at', end)

  if (!data) { res.json({ success: true, data: [] }); return }

  const map = new Map<string, { name: string; qty: number; revenue: number }>()
  data.forEach((item) => {
    const name = (item.menu_products as unknown as { name: string })?.name ?? 'Desconocido'
    const existing = map.get(item.product_id) ?? { name, qty: 0, revenue: 0 }
    map.set(item.product_id, {
      name,
      qty: existing.qty + item.quantity,
      revenue: existing.revenue + Number(item.subtotal),
    })
  })

  const sorted = Array.from(map.entries())
    .map(([id, v]) => ({ product_id: id, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)

  res.json({ success: true, data: sorted })
}

export async function getSalesByHour(req: AuthRequest, res: Response): Promise<void> {
  const { start, end } = todayRange()

  const { data: orders } = await supabase
    .from('orders')
    .select('total, created_at')
    .eq('tenant_id', req.user!.tenantId)
    .in('status', ['paid', 'delivered'])
    .gte('created_at', start)
    .lte('created_at', end)

  const hours: Record<number, { orders: number; revenue: number }> = {}
  for (let i = 0; i < 24; i++) hours[i] = { orders: 0, revenue: 0 }

  orders?.forEach(o => {
    const h = new Date(o.created_at).getHours()
    hours[h].orders++
    hours[h].revenue += Number(o.total)
  })

  const data = Object.entries(hours).map(([h, v]) => ({
    hour: parseInt(h),
    label: `${h.padStart(2, '0')}:00`,
    ...v,
  }))

  res.json({ success: true, data })
}
