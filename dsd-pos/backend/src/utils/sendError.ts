import { Response } from 'express'

const isProd = () => process.env['NODE_ENV'] === 'production'

// Mapea errores de Supabase/MercadoPago/JWT a un mensaje genérico en producción
// (esos mensajes pueden filtrar nombres de columnas, constraints o detalles de
// la cuenta del comercio). En desarrollo se muestra el mensaje real para debug.
export function sendError(res: Response, status: number, err: unknown, fallback = 'Error interno del servidor'): void {
  // Los errores de Supabase (PostgrestError) son objetos planos con `.message`,
  // no instancias de Error — hay que leerlos explícitamente o el mensaje real
  // se pierde como "[object Object]".
  const rawMessage =
    err instanceof Error ? err.message :
    (typeof err === 'object' && err !== null && 'message' in err) ? String((err as { message: unknown }).message) :
    String(err)
  console.error(`[Error ${status}]`, rawMessage)

  const safeMessage = isProd() ? fallback : rawMessage
  res.status(status).json({ success: false, error: safeMessage })
}
