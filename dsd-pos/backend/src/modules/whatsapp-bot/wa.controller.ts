import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth'
import { getWaStatus, getQrImage, startWaConnection } from './wa.service'

export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status } = getWaStatus()
  const qr = await getQrImage()
  res.json({ success: true, data: { status, qr } })
}

export async function connect(req: AuthRequest, res: Response): Promise<void> {
  await startWaConnection()
  res.json({ success: true, message: 'Conectando... escanea el QR desde /pos/settings' })
}
