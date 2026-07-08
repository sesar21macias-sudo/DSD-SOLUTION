import { Request, Response } from 'express'
import twilio from 'twilio'
import { supabase } from '../../config/supabase'
import { processWhatsAppMessage } from './whatsapp.agent'
import { AuthRequest } from '../../middleware/auth'
import { io } from '../../server'
import { sendError } from '../../utils/sendError'

const twilioClient = twilio(
  process.env['TWILIO_ACCOUNT_SID'],
  process.env['TWILIO_AUTH_TOKEN']
)

interface Message { role: 'user' | 'assistant'; content: string }

export async function handleIncoming(req: Request, res: Response): Promise<void> {
  const { tenantSlug } = req.params
  const { Body: body, From: from, ProfileName: profileName } = req.body

  if (!body || !from) { res.status(400).send('Missing fields'); return }

  const phone = from.replace('whatsapp:', '')
  const customerMessage = body.trim()

  // Responder a Twilio inmediatamente para evitar timeout
  res.status(200).send('<Response></Response>')

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', tenantSlug)
      .eq('is_active', true)
      .single()

    if (!tenant) {
      await sendWhatsApp(from, 'Lo sentimos, este servicio no está disponible.')
      return
    }

    // Obtener historial de conversación
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('phone', phone)
      .single()

    const rawMessages = (conversation?.messages ?? []) as { role: string; content: string }[]
    const history: Message[] = rawMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Procesar con Claude
    const { reply, newOrder } = await processWhatsAppMessage(
      tenant.id,
      tenant.name,
      phone,
      customerMessage,
      history
    )

    // Si se creó una orden, emitir al POS en tiempo real
    if (newOrder) {
      io.to(`tenant:${newOrder.tenant_id}`).emit('order:new', {
        ...newOrder,
        source: 'whatsapp',
        tables: null,
      })
      console.log(`[WhatsApp] Nueva orden ${newOrder.order_number} enviada al POS`)
    }

    // Actualizar historial
    const updatedMessages: Message[] = [
      ...history,
      { role: 'user' as const, content: customerMessage },
      { role: 'assistant' as const, content: reply },
    ].slice(-30)

    if (conversation) {
      await supabase
        .from('whatsapp_conversations')
        .update({
          messages: updatedMessages,
          customer_name: profileName ?? conversation.customer_name,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversation.id)
    } else {
      await supabase
        .from('whatsapp_conversations')
        .insert({
          tenant_id: tenant.id,
          phone,
          customer_name: profileName,
          messages: updatedMessages,
        })
    }

    await sendWhatsApp(from, reply)

  } catch (err) {
    console.error('[WhatsApp Agent Error]', err)
    await sendWhatsApp(from, 'Tuve un problemita técnico 😅 Intenta de nuevo en un momento.')
  }
}

async function sendWhatsApp(to: string, message: string): Promise<void> {
  await twilioClient.messages.create({
    from: `whatsapp:${process.env['TWILIO_WHATSAPP_NUMBER']}`,
    to,
    body: message,
  })
}

export async function getConversations(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('id, phone, customer_name, status, last_message_at, messages')
    .eq('tenant_id', req.user!.tenantId)
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (error) { sendError(res, 500, error); return }
  res.json({ success: true, data })
}
