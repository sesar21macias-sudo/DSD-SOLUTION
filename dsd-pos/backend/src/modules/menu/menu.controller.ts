import { Response } from 'express'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { ApiResponse } from '../../types'

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
})

const productSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price_mxn: z.number().positive(),
  price_usd: z.number().positive().optional(),
  sku: z.string().optional(),
  image_url: z.string().url().optional(),
  is_active: z.boolean().default(true),
  track_inventory: z.boolean().default(false),
  preparation_time_min: z.number().int().min(0).default(10),
})

// â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCategories(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('tenant_id', req.user!.tenantId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function createCategory(req: AuthRequest, res: Response): Promise<void> {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('menu_categories')
    .insert({ ...parsed.data, tenant_id: req.user!.tenantId })
    .select()
    .single()

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.status(201).json({ success: true, data })
}

export async function updateCategory(req: AuthRequest, res: Response): Promise<void> {
  const parsed = categorySchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('menu_categories')
    .update(parsed.data)
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .select()
    .single()

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function deleteCategory(req: AuthRequest, res: Response): Promise<void> {
  const { error } = await supabase
    .from('menu_categories')
    .update({ is_active: false })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, message: 'CategorÃ­a eliminada' })
}

// â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getProducts(req: AuthRequest, res: Response): Promise<void> {
  const { category_id } = req.query
  let query = supabase
    .from('menu_products')
    .select('*, menu_categories(name)')
    .eq('tenant_id', req.user!.tenantId)
    .eq('is_active', true)

  if (category_id) query = query.eq('category_id', category_id as string)

  const { data, error } = await query.order('name')
  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function getProduct(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('menu_products')
    .select('*, menu_categories(name)')
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .single()

  if (error || !data) { res.status(404).json({ success: false, error: 'Producto no encontrado' }); return }
  res.json({ success: true, data })
}

export async function createProduct(req: AuthRequest, res: Response): Promise<void> {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('menu_products')
    .insert({ ...parsed.data, tenant_id: req.user!.tenantId })
    .select()
    .single()

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.status(201).json({ success: true, data })
}

export async function updateProduct(req: AuthRequest, res: Response): Promise<void> {
  const parsed = productSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('menu_products')
    .update(parsed.data)
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .select()
    .single()

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function getTables(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('tenant_id', req.user!.tenantId)
    .eq('is_active', true)
    .order('number')
  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function deleteProduct(req: AuthRequest, res: Response): Promise<void> {
  const { error } = await supabase
    .from('menu_products')
    .update({ is_active: false })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, message: 'Producto eliminado' })
}

