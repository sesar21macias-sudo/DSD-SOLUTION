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

// ── Tendencias: período actual vs período anterior (semana o mes) ─────────────
export async function getTrends(req: AuthRequest, res: Response): Promise<void> {
  const period = req.query['period'] === 'month' ? 'month' : 'week'
  const days = period === 'month' ? 30 : 7

  const now = new Date()
  const currentStart = new Date(now); currentStart.setDate(now.getDate() - days); currentStart.setHours(0, 0, 0, 0)
  const previousStart = new Date(currentStart); previousStart.setDate(currentStart.getDate() - days)
  const previousEnd = new Date(currentStart); previousEnd.setMilliseconds(-1)

  const { data: orders } = await supabase
    .from('orders')
    .select('total, created_at, status')
    .eq('tenant_id', req.user!.tenantId)
    .in('status', ['paid', 'delivered'])
    .gte('created_at', previousStart.toISOString())
    .lte('created_at', now.toISOString())

  const current  = { orders: 0, revenue: 0 }
  const previous = { orders: 0, revenue: 0 }

  orders?.forEach(o => {
    const t = new Date(o.created_at)
    const bucket = t >= currentStart ? current : (t >= previousStart && t <= previousEnd ? previous : null)
    if (!bucket) return
    bucket.orders++
    bucket.revenue += Number(o.total)
  })

  const pctChange = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 1000) / 10
  }

  res.json({
    success: true,
    data: {
      period,
      current,
      previous,
      revenue_change_pct: pctChange(current.revenue, previous.revenue),
      orders_change_pct: pctChange(current.orders, previous.orders),
      avg_ticket_current: current.orders ? Math.round((current.revenue / current.orders) * 100) / 100 : 0,
      avg_ticket_previous: previous.orders ? Math.round((previous.revenue / previous.orders) * 100) / 100 : 0,
    },
  })
}

// ── Mezcla de productos: % de revenue por categoría en los últimos N días ─────
export async function getProductMix(req: AuthRequest, res: Response): Promise<void> {
  const days = Number(req.query['days']) || 30
  const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('order_items')
    .select('subtotal, menu_products(category_id, menu_categories(name))')
    .eq('tenant_id', req.user!.tenantId)
    .gte('created_at', since.toISOString())

  if (!data) { res.json({ success: true, data: [] }); return }

  const byCategory = new Map<string, number>()
  let total = 0
  data.forEach((item) => {
    const product = item.menu_products as unknown as { category_id: string; menu_categories: { name: string } | null } | null
    const catName = product?.menu_categories?.name ?? 'Sin categoría'
    const amount = Number(item.subtotal)
    byCategory.set(catName, (byCategory.get(catName) ?? 0) + amount)
    total += amount
  })

  const result = Array.from(byCategory.entries())
    .map(([category, revenue]) => ({
      category,
      revenue: Math.round(revenue * 100) / 100,
      pct: total > 0 ? Math.round((revenue / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  res.json({ success: true, data: result })
}

// ── Márgenes por producto: usa el campo `cost` de menu_products ───────────────
export async function getMargins(req: AuthRequest, res: Response): Promise<void> {
  const days = Number(req.query['days']) || 30
  const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('order_items')
    .select('product_id, quantity, subtotal, menu_products(name, cost)')
    .eq('tenant_id', req.user!.tenantId)
    .gte('created_at', since.toISOString())

  if (!data) { res.json({ success: true, data: [] }); return }

  const map = new Map<string, { name: string; qty: number; revenue: number; cost: number | null }>()
  data.forEach((item) => {
    const product = item.menu_products as unknown as { name: string; cost: number | null } | null
    const existing = map.get(item.product_id) ?? { name: product?.name ?? 'Desconocido', qty: 0, revenue: 0, cost: product?.cost ?? null }
    map.set(item.product_id, {
      name: existing.name,
      qty: existing.qty + item.quantity,
      revenue: existing.revenue + Number(item.subtotal),
      cost: product?.cost ?? null,
    })
  })

  const result = Array.from(map.entries())
    .map(([id, v]) => {
      const totalCost = v.cost !== null ? v.cost * v.qty : null
      const marginPct = v.cost !== null && v.revenue > 0 ? Math.round(((v.revenue - totalCost!) / v.revenue) * 1000) / 10 : null
      return {
        product_id: id,
        name: v.name,
        qty: v.qty,
        revenue: Math.round(v.revenue * 100) / 100,
        cost: totalCost !== null ? Math.round(totalCost * 100) / 100 : null,
        margin_pct: marginPct,
        has_cost_data: v.cost !== null,
      }
    })
    .sort((a, b) => (a.margin_pct ?? 999) - (b.margin_pct ?? 999))

  res.json({ success: true, data: result })
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
