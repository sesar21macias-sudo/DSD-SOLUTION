import { Request, Response } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../../middleware/auth'
import { supabase } from '../../config/supabase'
import { getWaStatus, sendWhatsAppMessage } from './wa.service'

export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  res.json({ success: true, data: getWaStatus() })
}

const testSchema = z.object({ phone: z.string().min(10) })

// Manda un mensaje de prueba — util para la demo y para confirmar que el
// numero ya se unio al sandbox de Twilio antes de fiarse del flujo real.
export async function sendTest(req: AuthRequest, res: Response): Promise<void> {
  const parsed = testSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const sent = await sendWhatsAppMessage(parsed.data.phone, 'Este es un mensaje de prueba de DSD POS. Si lo recibiste, WhatsApp esta conectado correctamente!')
  if (!sent) { res.status(400).json({ success: false, error: 'No se pudo enviar. Revisa que el numero se haya unido al sandbox de Twilio.' }); return }
  res.json({ success: true, message: 'Mensaje de prueba enviado' })
}

function resolveFrontend(): string {
  const raw = (process.env['FRONTEND_URL'] ?? '').split(',')[0].trim()
  return raw && !raw.includes('localhost') ? raw : 'https://dsd-solution.vercel.app'
}

// Webhook de Twilio: "cuando llegue un mensaje" apunta aqui. Por ahora
// solo un tenant usa el sandbox, asi que se hardcodea a Red Panda — cuando
// haya mas negocios con su propio numero de WhatsApp, este mapeo se hace
// por el numero "To" que Twilio manda.
const TENANT_SLUG = 'red-panda'

export async function incomingMessage(req: Request, res: Response): Promise<void> {
  const from = String(req.body?.From ?? '').replace('whatsapp:', '')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', TENANT_SLUG)
    .eq('is_active', true)
    .single()

  const { data: categories } = tenant
    ? await supabase.from('menu_categories').select('name').eq('tenant_id', tenant.id).eq('is_active', true).order('sort_order').limit(8)
    : { data: [] as { name: string }[] }

  const menuList = (categories ?? []).map(c => `- ${c.name}`).join('\n')
  const link = `${resolveFrontend()}/${TENANT_SLUG}`

  const reply = `Hola! Soy el asistente de ${tenant?.name ?? 'Red Panda'}. Nuestro menu:\n\n${menuList}\n\nOrdena aqui: ${link}`

  console.log('[WhatsApp] Mensaje entrante de', from)

  res.set('Content-Type', 'text/xml')
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`)
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
