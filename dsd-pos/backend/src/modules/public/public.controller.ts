import { Request, Response } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../../config/supabase'
import { io } from '../../server'
import { sendError } from '../../utils/sendError'

export async function getTableInfo(req: Request, res: Response): Promise<void> {
  const { tenantSlug, tableId } = req.params

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, logo_url, currency')
    .eq('slug', tenantSlug)
    .eq('is_active', true)
    .single()

  if (!tenant) { res.status(404).json({ success: false, error: 'Negocio no encontrado' }); return }

  const { data: table } = await supabase
    .from('tables')
    .select('id, number, name, capacity, status')
    .eq('id', tableId)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .single()

  if (!table) { res.status(404).json({ success: false, error: 'Mesa no encontrada' }); return }

  res.json({ success: true, data: { tenant, table } })
}

export async function getPublicTables(req: Request, res: Response): Promise<void> {
  const { tenantSlug } = req.params
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).eq('is_active', true).single()
  if (!tenant) { res.status(404).json({ success: false, error: 'Negocio no encontrado' }); return }
  const { data: tables } = await supabase.from('tables').select('id, name, status').eq('tenant_id', tenant.id).eq('is_active', true).order('name')
  res.json({ success: true, data: tables ?? [] })
}

export async function getPublicMenu(req: Request, res: Response): Promise<void> {
  const { tenantSlug } = req.params

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, logo_url, currency')
    .eq('slug', tenantSlug)
    .eq('is_active', true)
    .single()

  if (!tenant) { res.status(404).json({ success: false, error: 'Negocio no encontrado' }); return }

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order')

  const { data: products } = await supabase
    .from('menu_products')
    .select('id, name, description, price_mxn, price_usd, image_url, category_id, preparation_time_min')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name')

  res.json({ success: true, data: { tenant, categories, products } })
}

export async function createPublicOrder(req: Request, res: Response): Promise<void> {
  const { tenantSlug, tableId } = req.params

  const schema = z.object({
    customer_name: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    })).min(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, currency, tax_rate')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) { res.status(404).json({ success: false, error: 'Negocio no encontrado' }); return }

  const { data: table } = await supabase
    .from('tables')
    .select('id, number')
    .eq('id', tableId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!table) { res.status(404).json({ success: false, error: 'Mesa no encontrada' }); return }

  // Obtener precios de productos
  const productIds = parsed.data.items.map(i => i.product_id)
  const { data: products } = await supabase
    .from('menu_products')
    .select('id, name, price_mxn, price_usd, is_active')
    .in('id', productIds)
    .eq('tenant_id', tenant.id)

  const inactive = parsed.data.items.find(i => {
    const p = products?.find(p => p.id === i.product_id)
    return !p || !p.is_active
  })
  if (inactive) { res.status(400).json({ success: false, error: 'Producto no disponible' }); return }

  const currency = tenant.currency ?? 'MXN'
  const orderItems = parsed.data.items.map(item => {
    const product = products!.find(p => p.id === item.product_id)!
    const unitPrice = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
    const subtotal = unitPrice * item.quantity
    return { id: uuidv4(), product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice, subtotal, notes: item.notes }
  })

  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0)
  const taxRate = Number(tenant.tax_rate ?? 0.16)
  const tax = subtotal * taxRate
  const total = subtotal + tax
  const orderNumber = `QR-${Date.now().toString(36).toUpperCase()}`

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenant.id,
      order_number: orderNumber,
      type: 'dine_in',
      table_id: table.id,
      customer_name: parsed.data.customer_name,
      notes: parsed.data.notes,
      currency,
      status: 'pending',
      subtotal,
      tax,
      total,
    })
    .select()
    .single()

  if (error || !order) { sendError(res, 500, error, 'No se pudo procesar la orden'); return }

  await supabase.from('order_items').insert(
    orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: tenant.id }))
  )

  // Notificar a cocina y caja en tiempo real
  io.to(`tenant:${tenant.id}`).emit('order:new', {
    ...order,
    order_items: orderItems,
    source: 'qr',
    table_number: table.number,
  })

  res.status(201).json({ success: true, data: { order_number: orderNumber, total, currency } })
}

export async function createOnlineOrder(req: Request, res: Response): Promise<void> {
  const { tenantSlug } = req.params

  const schema = z.object({
    customer_name:  z.string().min(1),
    customer_phone: z.string().optional(),
    notes:          z.string().optional(),
    order_type:     z.enum(['takeout', 'delivery', 'dine_in']).default('takeout'),
    table_id:       z.string().uuid().optional(),
    require_payment: z.boolean().optional().default(false),
    items: z.array(z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    })).min(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, currency, tax_rate')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) { res.status(404).json({ success: false, error: 'Negocio no encontrado' }); return }

  const productIds = parsed.data.items.map(i => i.product_id)
  const { data: products } = await supabase
    .from('menu_products')
    .select('id, name, price_mxn, price_usd, is_active')
    .in('id', productIds)
    .eq('tenant_id', tenant.id)

  const inactive = parsed.data.items.find(i => {
    const p = products?.find(p => p.id === i.product_id)
    return !p || !p.is_active
  })
  if (inactive) { res.status(400).json({ success: false, error: 'Producto no disponible' }); return }

  const currency = tenant.currency ?? 'MXN'
  const orderItems = parsed.data.items.map(item => {
    const product = products!.find(p => p.id === item.product_id)!
    const unitPrice = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn
    const subtotal = unitPrice * item.quantity
    return { id: uuidv4(), product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice, subtotal, notes: item.notes }
  })

  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0)
  const taxRate = Number(tenant.tax_rate ?? 0.16)
  const tax = subtotal * taxRate
  const total = subtotal + tax
  const orderNumber = `WEB-${Date.now().toString(36).toUpperCase()}`

  const requirePayment = parsed.data.require_payment
  const orderStatus = requirePayment ? 'pending_payment' : 'pending'

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tenant_id:      tenant.id,
      order_number:   orderNumber,
      type:           parsed.data.order_type,
      table_id:       parsed.data.table_id ?? null,
      customer_name:  parsed.data.customer_name,
      notes:          parsed.data.notes,
      customer_phone: parsed.data.customer_phone?.replace(/\D/g, '') ?? null,
      currency,
      status:         orderStatus,
      subtotal,
      tax,
      total,
    })
    .select()
    .single()

  if (error || !order) { sendError(res, 500, error, 'No se pudo procesar la orden'); return }

  await supabase.from('order_items').insert(
    orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: tenant.id }))
  )

  if (!requirePayment) {
    io.to(`tenant:${tenant.id}`).emit('order:new', {
      ...order,
      order_items: orderItems,
      source: 'web',
    })
  }

  res.status(201).json({ success: true, data: { order_id: order.id, order_number: orderNumber, total, currency } })
}

// ── POST /api/public/loyalty/identify/:tenantSlug ─────────────────────────────
// Public endpoint — no auth. Looks up or creates a loyalty customer by phone.
export async function identifyLoyaltyCustomer(req: Request, res: Response): Promise<void> {
  const { tenantSlug } = req.params

  const schema = z.object({
    phone: z.string().min(7),
    name:  z.string().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .eq('is_active', true)
    .single()
  if (!tenant) { res.status(404).json({ success: false, error: 'Restaurante no encontrado' }); return }

  const phone = parsed.data.phone.replace(/\D/g, '')

  const { data: existing } = await supabase
    .from('loyalty_customers')
    .select('id, full_name, points, total_visits, tier')
    .eq('tenant_id', tenant.id)
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    if (parsed.data.name && !existing.full_name) {
      await supabase.from('loyalty_customers').update({ full_name: parsed.data.name }).eq('id', existing.id)
      existing.full_name = parsed.data.name
    }
    res.json({ success: true, data: { customer: existing, is_new: false } })
    return
  }

  const { data: customer, error } = await supabase
    .from('loyalty_customers')
    .insert({
      tenant_id:    tenant.id,
      phone,
      full_name:    parsed.data.name ?? null,
      points:       0,
      total_visits: 0,
      total_spent:  0,
      tier:         'bronze',
    })
    .select('id, full_name, points, total_visits, tier')
    .single()

  if (error || !customer) { sendError(res, 500, error, 'No se pudo registrar el cliente'); return }
  res.status(201).json({ success: true, data: { customer, is_new: true } })
}
