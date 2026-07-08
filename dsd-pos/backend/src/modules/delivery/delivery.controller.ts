import { Request, Response } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { io } from '../../server'
import { sendError } from '../../utils/sendError'

// ── Configuración (autenticado, panel de admin) ────────────────────────────────

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  const { data } = await supabase
    .from('delivery_integrations')
    .select('id, provider, is_active, webhook_secret, created_at')
    .eq('tenant_id', req.user!.tenantId)
    .maybeSingle()

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', req.user!.tenantId).single()

  res.json({
    success: true,
    data: {
      integration: data ?? null,
      webhook_url: tenant ? `${process.env['BACKEND_URL'] ?? 'http://localhost:4000'}/api/delivery/webhook/${tenant.slug}` : null,
    },
  })
}

const upsertSchema = z.object({
  provider: z.enum(['chowly', 'otter', 'deliverect', 'other']).default('other'),
  is_active: z.boolean().default(true),
})

export async function upsertSettings(req: AuthRequest, res: Response): Promise<void> {
  const parsed = upsertSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data: existing } = await supabase
    .from('delivery_integrations')
    .select('id, webhook_secret')
    .eq('tenant_id', req.user!.tenantId)
    .maybeSingle()

  const { data, error } = await supabase
    .from('delivery_integrations')
    .upsert({
      tenant_id: req.user!.tenantId,
      provider: parsed.data.provider,
      is_active: parsed.data.is_active,
      webhook_secret: existing?.webhook_secret ?? crypto.randomBytes(24).toString('hex'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    .select()
    .single()

  if (error) { sendError(res, 500, error, 'No se pudo guardar la configuración'); return }
  res.json({ success: true, data })
}

export async function regenerateSecret(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('delivery_integrations')
    .update({ webhook_secret: crypto.randomBytes(24).toString('hex'), updated_at: new Date().toISOString() })
    .eq('tenant_id', req.user!.tenantId)
    .select()
    .single()

  if (error || !data) { res.status(404).json({ success: false, error: 'No hay integración configurada todavía' }); return }
  res.json({ success: true, data })
}

// ── Webhook público (llamado por el agregador) ─────────────────────────────────
//
// Payload normalizado esperado (varía por agregador real — Chowly/Otter/Deliverect
// exponen formatos ligeramente distintos; este es el contrato mínimo común que
// asumimos aquí, y habría que adaptarlo al proveedor real elegido):
// {
//   "external_order_id": "string",
//   "provider": "ubereats" | "doordash" | "grubhub" | "other",
//   "customer_name": "string",
//   "customer_phone": "string" (opcional),
//   "currency": "MXN" | "USD",
//   "items": [{ "name": "string", "quantity": 1, "price": 10.5, "notes": "string" (opcional) }]
// }
const webhookItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  notes: z.string().optional(),
})

const webhookSchema = z.object({
  external_order_id: z.string().min(1),
  provider: z.string().default('other'),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  items: z.array(webhookItemSchema).min(1),
})

export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  const { tenantSlug } = req.params

  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).eq('is_active', true).single()
  if (!tenant) { res.status(404).json({ success: false, error: 'Negocio no encontrado' }); return }

  const { data: integration } = await supabase
    .from('delivery_integrations')
    .select('webhook_secret, is_active')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!integration || !integration.is_active) {
    res.status(404).json({ success: false, error: 'Integración de delivery no configurada' }); return
  }

  const providedSecret = req.headers['x-webhook-secret']
  if (providedSecret !== integration.webhook_secret) {
    res.status(401).json({ success: false, error: 'Secreto de webhook inválido' }); return
  }

  const parsed = webhookSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { external_order_id, provider, customer_name, customer_phone, currency, items } = parsed.data

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const tax = Math.round(subtotal * 0.16 * 100) / 100
  const total = subtotal + tax
  const orderNumber = `DLV-${Date.now().toString(36).toUpperCase()}`

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenant.id,
      order_number: orderNumber,
      type: 'delivery',
      status: 'pending',
      customer_name: customer_name ?? `Pedido ${provider}`,
      customer_phone,
      notes: `${provider} #${external_order_id}`,
      currency,
      subtotal,
      tax,
      total,
    })
    .select()
    .single()

  if (orderError || !order) { sendError(res, 500, orderError, 'No se pudo crear la orden'); return }

  // Los items de agregadores no mapean a menu_products (no compartimos catálogo
  // con la plataforma externa) — se guardan como línea libre vía `notes`.
  const orderItems = items.map(i => ({
    id: uuidv4(),
    order_id: order.id,
    tenant_id: tenant.id,
    product_id: null,
    quantity: i.quantity,
    unit_price: i.price,
    subtotal: i.price * i.quantity,
    notes: i.notes ? `${i.name} — ${i.notes}` : i.name,
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
  if (itemsError) { sendError(res, 500, itemsError, 'No se pudo crear la orden'); return }

  io.to(`tenant:${tenant.id}`).emit('order:new', { ...order, order_items: orderItems, source: provider })

  res.status(201).json({ success: true, data: { order_id: order.id, order_number: order.order_number } })
}
