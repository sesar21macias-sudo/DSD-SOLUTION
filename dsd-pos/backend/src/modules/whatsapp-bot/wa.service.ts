// Envio de WhatsApp via Twilio (API oficial, sin riesgo de que baneen un
// numero personal). Hoy corre sobre el sandbox de prueba de Twilio: cada
// destinatario debe unirse una vez mandando "join <palabra>" al numero de
// Twilio antes de poder recibir mensajes — perfecto para demo, no para
// mandar promos en frio a cualquier cliente todavia. Para produccion real
// hace falta pasar la cuenta de Twilio a pago + verificar el negocio ante
// Meta y usar un numero de WhatsApp Business propio (mismo codigo, solo
// cambian las credenciales en .env).

function twilioConfigured(): boolean {
  return !!(process.env['TWILIO_ACCOUNT_SID'] && process.env['TWILIO_AUTH_TOKEN'] && process.env['TWILIO_WHATSAPP_NUMBER'])
}

export function getWaStatus(): { status: string; qr: string | null; sandboxNumber: string | null } {
  if (!twilioConfigured()) return { status: 'not_configured', qr: null, sandboxNumber: null }
  return { status: 'connected', qr: null, sandboxNumber: process.env['TWILIO_WHATSAPP_NUMBER'] ?? null }
}

// Envia un mensaje de texto a un numero mexicano de 10 digitos (o ya con
// codigo de pais). No lanza si falla — nunca debe tumbar el flujo de
// pedidos/pagos por un problema de WhatsApp.
export async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
  if (!twilioConfigured()) return false

  try {
    const sid = process.env['TWILIO_ACCOUNT_SID']!
    const token = process.env['TWILIO_AUTH_TOKEN']!
    const from = process.env['TWILIO_WHATSAPP_NUMBER']!

    // WhatsApp usa "521" (con el 1 extra) para celulares mexicanos, no "52"
    // a secas -- con solo "52" el mensaje se manda a un numero que WhatsApp
    // nunca reconoce como el mismo que se unio al sandbox.
    const digits = phone.replace(/\D/g, '')
    const withCountry = digits.length === 10 ? `521${digits}` : digits

    const auth = Buffer.from(`${sid}:${token}`).toString('base64')
    const body = new URLSearchParams({
      To: `whatsapp:+${withCountry}`,
      From: `whatsapp:${from.startsWith('+') ? from : `+${from}`}`,
      Body: text,
    })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[WhatsApp/Twilio] Error enviando:', res.status, errBody)
      return false
    }
    return true
  } catch (err) {
    console.error('[WhatsApp/Twilio] Error enviando mensaje:', err)
    return false
  }
}
