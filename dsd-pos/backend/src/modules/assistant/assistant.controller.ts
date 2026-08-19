import { Response } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../../middleware/auth'
import { sendError } from '../../utils/sendError'
import { chatWithAssistant } from './assistant.agent'

const chatSchema = z.object({
  message: z.string().min(1).max(500),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(20).optional(),
})

export async function chat(req: AuthRequest, res: Response): Promise<void> {
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  try {
    const reply = await chatWithAssistant(req.user!.tenantId, parsed.data.message, parsed.data.history ?? [])
    res.json({ success: true, data: { reply } })
  } catch (err) {
    sendError(res, 500, err, 'El asistente no pudo responder en este momento')
  }
}
