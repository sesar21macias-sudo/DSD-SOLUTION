import { Request, Response } from 'express'
import { z } from 'zod'
import MercadoPagoConfig, { Preference, Payment } from 'mercadopago'
import { supabase } from '../../config/supabase'
import { io } from '../../server'
import { accrueLoyaltyPoints } from '../loyalty/loyalty.service'

declare module 'mercadopago' {
  interface PaymentCreateData {
    transaction_amount: number
    token?: string
    description?: string
    installments?: number
    payment_method_id?: string
    issuer_id?: number
    payer?: { email?: string; identification?: { type?: string; number?: string } }
    external_reference?: string
    notification_url?: string
  }
}

// ── Cliente MP por access token ──────────────────────────────────────────────
function mpClient(accessToken: string) {
  return new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } })
}

// ── GET /api/mp/order/:tenantSlug/:tableId ────────────────────────────────────
// Retorna la orden activa de una mesa para la página de pago del cliente
export async function getOrderForPayment(req: Request, res: Response): Promise<void> {
  const { tenantSlug, tableId } = req.params

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, currency, mp_public_key')
    .eq('slug', tenantSlug)
    .eq('is_active', true)
    .single()

  if (!tenant) { res.status(404).json({ success: false, error: 'Restaurante no encontrado' }); return }

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, subtotal, tax, total, status, currency,
      customer_name, tip_amount, tip_percent, created_at,
      order_items (
        id, quantity, unit_price, subtotal,
        menu_products ( id, name )
      )
    `)
    .eq('tenant_id', tenant.id)
    .eq('table_id', tableId)
    .not('status', 'in', '("paid","cancelled")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    res.status(404).json({ success: false, error: 'No hay una orden activa en esta mesa' }); return
  }

  res.json({
    success: true,
    data: {
      tenant: { name: tenant.name, currency: tenant.currency ?? 'MXN', mp_public_key: tenant.mp_public_key },
      order,
    },
  })
}

// ── POST /api/mp/preference ───────────────────────────────────────────────────
// Crea preferencia de Checkout Pro y devuelve el init_point
export async function createPreference(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    order_id:    z.string().uuid(),
    tip_percent: z.number().min(0).max(100).default(0),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { order_id, tip_percent } = parsed.data
  const { tenantSlug } = req.params

  // Cargar orden + items + tenant, forzando que la orden pertenezca al tenant del slug de la URL
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, subtotal, tax, total, status, currency, customer_name, tenant_id, table_id,
      order_items ( id, quantity, unit_price, menu_products ( name ) ),
      tenants!inner ( name, slug, mp_access_token, mp_public_key )
    `)
    .eq('id', order_id)
    .eq('tenants.slug', tenantSlug)
    .single()

  if (!order) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return }
  if (order.status === 'paid') { res.status(400).json({ success: false, error: 'Esta orden ya fue pagada' }); return }

  const tenant      = (order as any).tenants as { name: string; slug: string; mp_access_token?: string; mp_public_key?: string }
  const accessToken = tenant?.mp_access_token ?? process.env['MP_ACCESS_TOKEN']

  if (!accessToken || accessToken.startsWith('TEST-000')) {
    res.status(400).json({ success: false, error: 'Credenciales de Mercado Pago no configuradas. Agrega MP_ACCESS_TOKEN en .env o conecta tu cuenta de MP desde el panel.' })
    return
  }

  // Calcular propina y nuevo total
  const subtotal   = Number(order.subtotal)
  const tipAmount  = Math.round(subtotal * (tip_percent / 100) * 100) / 100
  const totalWithTip = Number(order.total) + tipAmount

  // Items para MP
  const items = ((order as any).order_items as any[]).map((item: any) => ({
    id:         item.id,
    title:      item.menu_products?.name ?? 'Producto',
    quantity:   Number(item.quantity),
    unit_price: Number(item.unit_price),
    currency_id: order.currency ?? 'MXN',
  }))

  if (tipAmount > 0) {
    items.push({
      id:         'propina',
      title:      `Propina ${tip_percent}%`,
      quantity:   1,
      unit_price: tipAmount,
      currency_id: order.currency ?? 'MXN',
    })
  }

  const FRONTEND = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'
  const BACKEND  = process.env['BACKEND_URL']  ?? 'http://localhost:4000'
  const slug     = tenant.slug
  const tableId  = order.table_id ?? order_id  // use order_id as fallback for takeout

  const isLocalhost = FRONTEND.includes('localhost') || FRONTEND.includes('127.0.0.1')

  const prefClient  = new Preference(mpClient(accessToken))
  const prefResponse = await prefClient.create({
    body: {
      items,
      payer:               { name: order.customer_name ?? 'Cliente' },
      external_reference:  order_id,
      statement_descriptor: tenant.name ?? 'DSD Restaurante',
      notification_url:    `${BACKEND}/api/mp/webhook`,
      ...(isLocalhost ? {} : { auto_return: 'approved' }),
      back_urls: {
        success: `${FRONTEND}/pagar/${slug}/${tableId}/exito?order=${order.order_number}`,
        failure: `${FRONTEND}/pagar/${slug}/${tableId}/error`,
        pending: `${FRONTEND}/pagar/${slug}/${tableId}`,
      },
    },
  })

  // Guardar preference_id + propina en la orden
  await supabase.from('orders').update({
    mp_preference_id: prefResponse.id,
    tip_amount:       tipAmount,
    tip_percent:      tip_percent,
    total:            totalWithTip,
    updated_at:       new Date().toISOString(),
  }).eq('id', order_id)

  // En sandbox usar sandbox_init_point, en prod usar init_point
  const initPoint = process.env['NODE_ENV'] === 'production'
    ? prefResponse.init_point
    : prefResponse.sandbox_init_point

  const publicKey = tenant?.mp_public_key ?? process.env['MP_PUBLIC_KEY'] ?? ''

  res.json({ success: true, data: { preference_id: prefResponse.id, init_point: initPoint, public_key: publicKey } })
}

// ── POST /api/mp/webhook ──────────────────────────────────────────────────────
// Recibe notificaciones IPN de Mercado Pago
export async function mpWebhook(req: Request, res: Response): Promise<void> {
  // Responder 200 inmediatamente para que MP no reintente
  res.status(200).json({ received: true })

  try {
    const { type, data } = req.body as { type?: string; data?: { id?: string } }
    if (type !== 'payment' || !data?.id) return

    const paymentId   = String(data.id)
    const accessToken = process.env['MP_ACCESS_TOKEN']
    if (!accessToken) return

    // Consultar el pago en la API de MP
    const payClient = new Payment(mpClient(accessToken))
    const payment   = await payClient.get({ id: paymentId })

    console.log(`[MP Webhook] Payment ${paymentId} status: ${payment.status}`)
    if (payment.status !== 'approved') return

    const orderId = payment.external_reference
    if (!orderId) return

    // Cargar orden actual para saber su status previo
    const { data: orderBefore } = await supabase
      .from('orders')
      .select('id, order_number, tenant_id, table_id, total, status, customer_phone, order_items(id, quantity, unit_price, subtotal, product_id)')
      .eq('id', orderId)
      .single()

    if (!orderBefore) { console.error('[MP Webhook] Orden no encontrada:', orderId); return }

    const wasPendingPayment = orderBefore.status === 'pending_payment'

    // Marcar orden como pagada
    const { data: order } = await supabase
      .from('orders')
      .update({
        status:        'paid',
        mp_payment_id: paymentId,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, order_number, tenant_id, table_id, total')
      .single()

    if (!order) { console.error('[MP Webhook] Error actualizando orden:', orderId); return }

    // Registrar pago en tabla payments
    await supabase.from('payments').insert({
      tenant_id:     order.tenant_id,
      order_id:      orderId,
      amount:        payment.transaction_amount ?? order.total,
      currency:      payment.currency_id ?? 'MXN',
      method:        'card',
      status:        'completed',
      mp_payment_id: paymentId,
    })

    accrueLoyaltyPoints({
      tenantId: order.tenant_id,
      customerPhone: orderBefore.customer_phone,
      amountSpent: payment.transaction_amount ?? Number(order.total),
      orderId,
    }).catch(err => console.error('[Loyalty] Error acumulando puntos:', err))

    // Liberar la mesa
    if (order.table_id) {
      await supabase.from('tables')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .eq('id', order.table_id)
    }

    // Si la orden estaba en pending_payment, notificar a cocina ahora que fue pagada
    if (wasPendingPayment) {
      io.to(`tenant:${order.tenant_id}`).emit('order:new', {
        ...orderBefore,
        status: 'paid',
        source: 'web',
      })
    }

    // Notificación en tiempo real a cocina y POS
    io.to(`tenant:${order.tenant_id}`).emit('order:paid', {
      order_id:      orderId,
      order_number:  order.order_number,
      mp_payment_id: paymentId,
      table_id:      order.table_id,
    })

    console.log(`[MP Webhook] ✅ Orden ${order.order_number} marcada como pagada`)

  } catch (err) {
    console.error('[MP Webhook] Error procesando notificación:', err)
  }
}

// ── POST /api/mp/process-card ─────────────────────────────────────────────────
// Procesa pago con tarjeta tokenizada desde el Payment Brick (sin redirigir)
export async function processCardPayment(req: Request, res: Response): Promise<void> {
  const schema = z.object({
    order_id:          z.string().uuid(),
    token:             z.string(),
    payment_method_id: z.string(),
    issuer_id:         z.union([z.string(), z.number()]).optional(),
    installments:      z.number().int().min(1).default(1),
    payer: z.object({
      email:          z.string().email().optional(),
      identification: z.object({ type: z.string(), number: z.string() }).optional(),
    }).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { order_id, token, payment_method_id, issuer_id, installments, payer } = parsed.data
  const { tenantSlug } = req.params

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total, tenant_id, table_id, status, tenants!inner(mp_access_token, name, slug)')
    .eq('id', order_id)
    .eq('tenants.slug', tenantSlug)
    .single()

  if (!order) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return }
  if (order.status === 'paid') { res.status(400).json({ success: false, error: 'Esta orden ya fue pagada' }); return }

  const tenant      = (order as any).tenants as { name: string; mp_access_token?: string }
  const accessToken = tenant?.mp_access_token ?? process.env['MP_ACCESS_TOKEN']

  if (!accessToken) { res.status(400).json({ success: false, error: 'Credenciales de Mercado Pago no configuradas' }); return }

  const BACKEND = process.env['BACKEND_URL'] ?? 'http://localhost:4000'

  const payClient = new Payment(mpClient(accessToken))
  const payment = await payClient.create({
    body: {
      transaction_amount: Number(order.total),
      token,
      description:        `Orden ${order.order_number} - ${tenant.name ?? 'DSD Restaurante'}`,
      installments:       Number(installments),
      payment_method_id,
      issuer_id:          issuer_id ? Number(issuer_id) : undefined,
      payer:              payer ?? {},
      external_reference: order_id,
      notification_url:   `${BACKEND}/api/mp/webhook`,
    } as any,
  })

  res.json({
    success: true,
    data: {
      status:        payment.status,
      status_detail: payment.status_detail,
      payment_id:    payment.id,
    },
  })
  // El webhook maneja el resto (marcar como pagada, notificar cocina)
}
