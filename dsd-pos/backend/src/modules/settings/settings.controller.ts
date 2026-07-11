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
})

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, currency, tax_rate, plan, address, phone, hours, description')
    .eq('id', req.user!.tenantId)
    .single()

  if (error || !data) { sendError(res, 404, error, 'Configuracion no encontrada'); return }
  res.json({ success: true, data })
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

  const { data, error } = await supabase
    .from('tenants')
    .update(patch)
    .eq('id', req.user!.tenantId)
    .select('id, name, slug, logo_url, currency, tax_rate, address, phone, hours, description')
    .single()

  if (error || !data) { sendError(res, 500, error, 'No se pudo guardar la configuracion'); return }
  res.json({ success: true, data })
}
