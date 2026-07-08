import { Response } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { OrderStatus, OrderType } from '../../types'
import { io } from '../../server'
import { deductInventoryForOrder } from '../inventory/inventory.controller'
import { logAudit } from '../../utils/auditLog'
import { sendError } from '../../utils/sendError'

const createOrderSchema = z.object({
  type: z.enum(['dine_in', 'takeout', 'delivery', 'online']),
  table_id: z.string().uuid().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  notes: z.string().optional(),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
    modifiers: z.array(z.object({
      name: z.string(),
      price: z.number(),
    })).optional(),
  })).min(1),
})

const addItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
})

export async function getOrders(req: AuthRequest, res: Response): Promise<void> {
  const { status, date, type } = req.query

  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items(*, menu_products(name, image_url)),
      tables(number, name)
    `)
    .eq('tenant_id', req.user!.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status as OrderStatus)
  if (type) query = query.eq('type', type as OrderType)
  if (date) {
    const start = new Date(date as string)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date as string)
    end.setHours(23, 59, 59, 999)
    query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) { sendError(res, 500, error); return }
  res.json({ success: true, data })
}

export async function getOrder(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(*, menu_products(name, description, image_url)),
      tables(number, name),
      tenants(name, address, phone)
    `)
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .single()

  if (error || !data) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return }
  res.json({ success: true, data })
}

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createOrderSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { items, ...orderData } = parsed.data

  // Fetch product prices
  const productIds = items.map(i => i.product_id)
  const { data: products, error: prodError } = await supabase
    .from('menu_products')
    .select('id, name, price_mxn, price_usd, is_active')
    .in('id', productIds)
    .eq('tenant_id', req.user!.tenantId)

  if (prodError || !products) { res.status(500).json({ success: false, error: 'Error al obtener productos' }); return }

  const inactiveOrMissing = items.find(i => {
    const p = products.find(p => p.id === i.product_id)
    return !p || !p.is_active
  })
  if (inactiveOrMissing) { res.status(400).json({ success: false, error: 'Uno o mÃ¡s productos no estÃ¡n disponibles' }); return }

  const currency = orderData.currency
  const orderItems = items.map(item => {
    const product = products.find(p => p.id === item.product_id)!
    const unitPrice = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
    const modifiersTotal = (item.modifiers ?? []).reduce((sum, m) => sum + m.price, 0)
    const subtotal = (unitPrice + modifiersTotal) * item.quantity
    return {
      id: uuidv4(),
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      modifiers: item.modifiers ?? [],
      notes: item.notes,
      subtotal,
    }
  })

  const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0)
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      ...orderData,
      tenant_id: req.user!.tenantId,
      created_by: req.user!.userId,
      order_number: orderNumber,
      status: 'pending',
      subtotal: total,
      tax: total * 0.16,
      total: total * 1.16,
    })
    .select()
    .single()

  if (orderError || !order) { sendError(res, 500, orderError, 'No se pudo crear la orden'); return }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: req.user!.tenantId })))

  if (itemsError) { sendError(res, 500, itemsError, 'No se pudo crear la orden'); return }

  io.to(`tenant:${req.user!.tenantId}`).emit('order:new', { ...order, order_items: orderItems })

  // Descontar inventario en segundo plano
  deductInventoryForOrder(
    req.user!.tenantId,
    order.id,
    items.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
  ).catch(err => console.error('[Inventory] Error descontando:', err))

  res.status(201).json({ success: true, data: { ...order, order_items: orderItems } })
}

export async function updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status } = req.body
  const validStatuses: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'paid', 'cancelled']

  if (!validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: 'Estado invÃ¡lido' }); return
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .select()
    .single()

  if (error || !data) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return }

  io.to(`tenant:${req.user!.tenantId}`).emit('order:updated', data)
  res.json({ success: true, data })
}

export async function addOrderItem(req: AuthRequest, res: Response): Promise<void> {
  const parsed = addItemSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data: order } = await supabase
    .from('orders')
    .select('id, currency, status')
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .single()

  if (!order) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return }
  if (['paid', 'cancelled'].includes(order.status)) {
    res.status(400).json({ success: false, error: 'No se pueden agregar items a esta orden' }); return
  }

  const { data: product } = await supabase
    .from('menu_products')
    .select('id, price_mxn, price_usd')
    .eq('id', parsed.data.product_id)
    .eq('tenant_id', req.user!.tenantId)
    .single()

  if (!product) { res.status(404).json({ success: false, error: 'Producto no encontrado' }); return }

  const unitPrice = order.currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
  const subtotal = unitPrice * parsed.data.quantity

  const { data: item, error } = await supabase
    .from('order_items')
    .insert({
      order_id: order.id,
      tenant_id: req.user!.tenantId,
      product_id: parsed.data.product_id,
      quantity: parsed.data.quantity,
      unit_price: unitPrice,
      subtotal,
      notes: parsed.data.notes,
    })
    .select()
    .single()

  if (error) { sendError(res, 500, error); return }

  // Recalculate order total
  const { data: allItems } = await supabase
    .from('order_items')
    .select('subtotal')
    .eq('order_id', order.id)

  const newSubtotal = (allItems ?? []).reduce((sum, i) => sum + i.subtotal, 0)
  await supabase.from('orders').update({
    subtotal: newSubtotal,
    tax: newSubtotal * 0.16,
    total: newSubtotal * 1.16,
  }).eq('id', order.id)

  res.status(201).json({ success: true, data: item })
}

export async function removeOrderItem(req: AuthRequest, res: Response): Promise<void> {
  const { error, count } = await supabase
    .from('order_items')
    .delete({ count: 'exact' })
    .eq('id', req.params['itemId'])
    .eq('order_id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)

  if (error) { sendError(res, 500, error); return }
  if (!count) { res.status(404).json({ success: false, error: 'Item no encontrado' }); return }

  await logAudit({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'order.item_remove',
    entityType: 'order_item',
    entityId: req.params['itemId'] as string,
    metadata: { orderId: req.params['id'] },
  })

  res.json({ success: true, message: 'Item eliminado' })
}

const discountSchema = z.object({
  type: z.enum(['amount', 'percentage']),
  value: z.number().min(0),
  reason: z.string().optional(),
})

// Aplica (o quita, con value: 0) un descuento manual a una orden antes de cobrarla.
// El descuento se calcula sobre el subtotal (antes de IVA) y nunca puede dejar el
// total en negativo.
export async function applyDiscount(req: AuthRequest, res: Response): Promise<void> {
  const parsed = discountSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { type, value, reason } = parsed.data

  const { data: order } = await supabase
    .from('orders')
    .select('id, subtotal, status')
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .single()

  if (!order) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return }
  if (['paid', 'cancelled'].includes(order.status)) {
    res.status(400).json({ success: false, error: 'No se puede aplicar descuento a una orden pagada o cancelada' }); return
  }

  const subtotal = Number(order.subtotal)
  const rawDiscount = type === 'percentage' ? subtotal * (Math.min(value, 100) / 100) : value
  const discount = Math.round(Math.min(rawDiscount, subtotal) * 100) / 100

  const taxableAmount = subtotal - discount
  const tax = Math.round(taxableAmount * 0.16 * 100) / 100
  const total = Math.round((taxableAmount + tax) * 100) / 100

  const { data: updated, error } = await supabase
    .from('orders')
    .update({ discount, tax, total, updated_at: new Date().toISOString() })
    .eq('id', req.params['id'])
    .select()
    .single()

  if (error || !updated) { sendError(res, 500, error, 'No se pudo aplicar el descuento'); return }

  await logAudit({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'order.discount',
    entityType: 'order',
    entityId: req.params['id'] as string,
    metadata: { type, value, discount, reason },
  })

  io.to(`tenant:${req.user!.tenantId}`).emit('order:updated', updated)

  res.json({ success: true, data: updated })
}

const mergeSchema = z.object({
  source_order_id: z.string().uuid(),
})

// Fusiona dos cuentas activas en una sola (ej. dos órdenes distintas en la misma
// mesa, o de dos mesas que se van a pagar juntas). Mueve los items de la orden
// origen a la destino, recalcula totales, y cancela la orden origen.
export async function mergeOrders(req: AuthRequest, res: Response): Promise<void> {
  const parsed = mergeSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const targetId = req.params['id'] as string
  const { source_order_id } = parsed.data

  if (source_order_id === targetId) {
    res.status(400).json({ success: false, error: 'No puedes fusionar una orden consigo misma' }); return
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, currency, table_id')
    .in('id', [targetId, source_order_id])
    .eq('tenant_id', req.user!.tenantId)

  const target = orders?.find(o => o.id === targetId)
  const source = orders?.find(o => o.id === source_order_id)

  if (!target || !source) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return }
  if (['paid', 'cancelled'].includes(target.status) || ['paid', 'cancelled'].includes(source.status)) {
    res.status(400).json({ success: false, error: 'No se pueden fusionar órdenes pagadas o canceladas' }); return
  }
  if (target.currency !== source.currency) {
    res.status(400).json({ success: false, error: 'No se pueden fusionar órdenes en distinta moneda' }); return
  }

  const { error: moveError } = await supabase
    .from('order_items')
    .update({ order_id: targetId })
    .eq('order_id', source_order_id)
    .eq('tenant_id', req.user!.tenantId)

  if (moveError) { sendError(res, 500, moveError, 'No se pudo fusionar la cuenta'); return }

  const { data: allItems } = await supabase.from('order_items').select('subtotal').eq('order_id', targetId)
  const newSubtotal = (allItems ?? []).reduce((sum, i) => sum + Number(i.subtotal), 0)

  const { data: updatedTarget, error: updateError } = await supabase
    .from('orders')
    .update({
      subtotal: newSubtotal,
      tax: newSubtotal * 0.16,
      total: newSubtotal * 1.16,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .select('*, order_items(*, menu_products(name, image_url)), tables(number, name)')
    .single()

  if (updateError || !updatedTarget) { sendError(res, 500, updateError, 'No se pudo fusionar la cuenta'); return }

  await supabase.from('orders').update({
    status: 'cancelled',
    cancellation_reason: `Fusionada con orden ${targetId}`,
    updated_at: new Date().toISOString(),
  }).eq('id', source_order_id)

  if (source.table_id && source.table_id !== target.table_id) {
    await supabase.from('tables').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', source.table_id)
  }

  await logAudit({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'order.merge',
    entityType: 'order',
    entityId: targetId,
    metadata: { sourceOrderId: source_order_id },
  })

  io.to(`tenant:${req.user!.tenantId}`).emit('order:updated', updatedTarget)

  res.json({ success: true, data: updatedTarget })
}

export async function cancelOrder(req: AuthRequest, res: Response): Promise<void> {
  const { reason } = req.body

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', cancellation_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .not('status', 'in', '("paid","cancelled")')
    .select()
    .single()

  if (error || !data) { res.status(400).json({ success: false, error: 'No se puede cancelar esta orden' }); return }

  await logAudit({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'order.cancel',
    entityType: 'order',
    entityId: data.id,
    metadata: { reason },
  })

  res.json({ success: true, data })
}

