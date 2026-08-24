import makeWASocket, { useMultiFileAuthState, DisconnectReason, WASocket } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import path from 'path'
import QRCode from 'qrcode'

// Un solo socket de WhatsApp para toda la instancia — suficiente para el
// volumen de un negocio chico (confirmaciones de pedido, promos puntuales).
// Se conecta escaneando un QR una sola vez, como WhatsApp Web — sin cuenta
// de WhatsApp Business API, sin verificacion de Meta, sin esperar aprobacion.
let sock: WASocket | null = null
let lastQR: string | null = null
let connectionStatus: 'disconnected' | 'connecting' | 'waiting_qr' | 'connected' = 'disconnected'

const AUTH_DIR = path.join(__dirname, '..', '..', '..', '.wa-auth')

export function getWaStatus(): { status: string; qr: string | null } {
  return { status: connectionStatus, qr: connectionStatus === 'waiting_qr' ? lastQR : null }
}

export async function startWaConnection(): Promise<void> {
  if (sock) return
  connectionStatus = 'connecting'

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  sock = makeWASocket({ auth: state, printQRInTerminal: false })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      lastQR = qr
      connectionStatus = 'waiting_qr'
    }

    if (connection === 'open') {
      connectionStatus = 'connected'
      lastQR = null
      console.log('[WhatsApp] Conectado')
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected'
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      sock = null
      console.log('[WhatsApp] Conexion cerrada, reconectar:', shouldReconnect)
      if (shouldReconnect) startWaConnection().catch(err => console.error('[WhatsApp] Error reconectando:', err))
    }
  })
}

export async function getQrImage(): Promise<string | null> {
  if (!lastQR) return null
  return QRCode.toDataURL(lastQR)
}

// Envia un mensaje de texto simple a un numero mexicano de 10 digitos (o ya
// con codigo de pais). No lanza si falla — nunca debe tumbar el flujo de
// pedidos/pagos por un problema de WhatsApp.
export async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
  if (!sock || connectionStatus !== 'connected') return false
  try {
    const digits = phone.replace(/\D/g, '')
    const withCountry = digits.length === 10 ? `52${digits}` : digits
    const jid = `${withCountry}@s.whatsapp.net`
    await sock.sendMessage(jid, { text })
    return true
  } catch (err) {
    console.error('[WhatsApp] Error enviando mensaje:', err)
    return false
  }
}
