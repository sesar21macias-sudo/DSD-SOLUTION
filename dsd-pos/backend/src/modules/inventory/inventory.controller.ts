import { Response } from 'express'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'

const ingredientSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  stock: z.number().min(0).default(0),
  min_stock: z.number().min(0).default(0),
  cost_per_unit: z.number().min(0).default(0),
  category: z.string().optional(),
})

// ── Ingredientes ──────────────────────────────────────────────

export async function getIngredients(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('tenant_id', req.user!.tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function createIngredient(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ingredientSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('ingredients')
    .insert({ ...parsed.data, tenant_id: req.user!.tenantId })
    .select()
    .single()

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.status(201).json({ success: true, data })
}

export async function updateIngredient(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ingredientSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { data, error } = await supabase
    .from('ingredients')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .select()
    .single()

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function getLowStock(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('tenant_id', req.user!.tenantId)
    .eq('is_active', true)

  if (error) { res.status(500).json({ success: false, error: error.message }); return }

  const low = (data ?? []).filter(i => Number(i.stock) <= Number(i.min_stock))
  res.json({ success: true, data: low })
}

// ── Recetas ───────────────────────────────────────────────────

export async function getRecipe(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, ingredients(id, name, unit, stock)')
    .eq('product_id', req.params['productId'])
    .eq('tenant_id', req.user!.tenantId)

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function saveRecipe(req: AuthRequest, res: Response): Promise<void> {
  const schema = z.object({
    items: z.array(z.object({
      ingredient_id: z.string().uuid(),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    })),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const productId = req.params['productId']

  // Borrar receta existente y reemplazar
  await supabase.from('recipes').delete().eq('product_id', productId).eq('tenant_id', req.user!.tenantId)

  if (parsed.data.items.length > 0) {
    const { error } = await supabase.from('recipes').insert(
      parsed.data.items.map(item => ({
        tenant_id: req.user!.tenantId,
        product_id: productId,
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
        unit: item.unit,
      }))
    )
    if (error) { res.status(500).json({ success: false, error: error.message }); return }
  }

  res.json({ success: true, message: 'Receta guardada' })
}

// ── Movimientos ───────────────────────────────────────────────

export async function getMovements(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*, ingredients(name, unit), users!created_by(full_name)')
    .eq('tenant_id', req.user!.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

export async function addMovement(req: AuthRequest, res: Response): Promise<void> {
  const schema = z.object({
    ingredient_id: z.string().uuid(),
    type: z.enum(['in', 'out', 'adjustment', 'waste']),
    quantity: z.number().positive(),
    notes: z.string().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { ingredient_id, type, quantity, notes } = parsed.data

  // Registrar movimiento
  const { error: mvError } = await supabase.from('inventory_movements').insert({
    tenant_id: req.user!.tenantId,
    ingredient_id,
    type,
    quantity,
    notes,
    created_by: req.user!.userId,
  })
  if (mvError) { res.status(500).json({ success: false, error: mvError.message }); return }

  // Actualizar stock
  const { data: ingredient } = await supabase
    .from('ingredients')
    .select('stock')
    .eq('id', ingredient_id)
    .single()

  const currentStock = Number(ingredient?.stock ?? 0)
  const newStock = type === 'in'
    ? currentStock + quantity
    : type === 'out' || type === 'waste'
    ? currentStock - quantity
    : quantity // adjustment = set directly

  const { data, error } = await supabase
    .from('ingredients')
    .update({ stock: Math.max(0, newStock), updated_at: new Date().toISOString() })
    .eq('id', ingredient_id)
    .eq('tenant_id', req.user!.tenantId)
    .select()
    .single()

  if (error) { res.status(500).json({ success: false, error: error.message }); return }
  res.json({ success: true, data })
}

// ── Descuento automático por orden ───────────────────────────

export async function deductInventoryForOrder(
  tenantId: string,
  orderId: string,
  items: { product_id: string; quantity: number }[]
): Promise<void> {
  for (const item of items) {
    // Obtener receta del producto
    const { data: recipe } = await supabase
      .from('recipes')
      .select('ingredient_id, quantity')
      .eq('product_id', item.product_id)
      .eq('tenant_id', tenantId)

    if (!recipe || recipe.length === 0) continue

    for (const r of recipe) {
      const needed = r.quantity * item.quantity

      // Registrar movimiento de salida
      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId,
        ingredient_id: r.ingredient_id,
        order_id: orderId,
        type: 'out',
        quantity: needed,
        notes: `Orden automática`,
      })

      // Descontar del stock
      const { data: ing } = await supabase
        .from('ingredients')
        .select('stock')
        .eq('id', r.ingredient_id)
        .single()

      const newStock = Math.max(0, Number(ing?.stock ?? 0) - needed)
      await supabase
        .from('ingredients')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', r.ingredient_id)
    }
  }
}
