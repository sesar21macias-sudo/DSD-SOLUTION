import { Response } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../../middleware/auth'
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
