import { Response } from 'express'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { sendError } from '../../utils/sendError'

const updateSchema = z.object({
  name:      z.string().min(2).max(80).optional(),
  logo_url:  z.string().url().max(500).or(z.literal('')).optional(),
  currency:  z.enum(['MXN', 'USD']).optional(),
  tax_rate:  z.number().min(0).max(1).optional(),
  address:   z.string().max(200).optional(),
  phone:     z.string().max(30).optional(),
  hours:     z.string().max(120).optional(),
  description: z.string().max(300).optional(),
  primary_color:   z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bg_color:        z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  surface_color:   z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  cover_image_url: z.string().url().max(500).or(z.literal('')).optional(),
  slogan:          z.string().max(120).optional(),
})

const FULL_COLS = 'id, name, slug, logo_url, currency, tax_rate, plan, address, phone, hours, description, primary_color, bg_color, surface_color, cover_image_url, slogan'
const BASE_COLS = 'id, name, slug, logo_url, currency, tax_rate, plan, address, phone, hours, description'

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  let result = await supabase.from('tenants').select(FULL_COLS).eq('id', req.user!.tenantId).single()
  if (result.error?.message?.includes('does not exist')) {
    result = await supabase.from('tenants').select(BASE_COLS).eq('id', req.user!.tenantId).single()
  }
  if (result.error || !result.data) { sendError(res, 404, result.error, 'Configuracion no encontrada'); return }
  res.json({ success: true, data: result.data })
}

export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return
  }

  const fields = parsed.data
  // Remove undefined keys so we only patch what was sent
  const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ success: false, error: 'No hay campos para actualizar' }); return
  }

  let result = await supabase.from('tenants').update(patch).eq('id', req.user!.tenantId).select(FULL_COLS).single()
  if (result.error?.message?.includes('does not exist')) {
    result = await supabase.from('tenants').update(patch).eq('id', req.user!.tenantId).select(BASE_COLS).single()
  }
  if (result.error || !result.data) { sendError(res, 500, result.error, 'No se pudo guardar la configuracion'); return }
  res.json({ success: true, data: result.data })
}

// Bundle completo de los datos del negocio — para que el dueno pueda irse del
// sistema sin quedar atrapado (menu, ordenes, clientes de lealtad, todo suyo).
export async function exportData(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId

  const [tenant, categories, products, orders, loyaltyCustomers, staff] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('menu_categories').select('*').eq('tenant_id', tenantId),
    supabase.from('menu_products').select('*').eq('tenant_id', tenantId),
    supabase.from('orders').select('*, order_items(*)').eq('tenant_id', tenantId),
    supabase.from('loyalty_customers').select('*').eq('tenant_id', tenantId),
    supabase.from('users').select('id, email, full_name, role, is_active, created_at').eq('tenant_id', tenantId),
  ])

  res.json({
    success: true,
    data: {
      exported_at: new Date().toISOString(),
      tenant: tenant.data,
      categories: categories.data ?? [],
      products: products.data ?? [],
      orders: orders.data ?? [],
      loyalty_customers: loyaltyCustomers.data ?? [],
      staff: staff.data ?? [],
    },
  })
}
