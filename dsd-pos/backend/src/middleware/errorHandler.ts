import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../types'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message, err.stack)

  const response: ApiResponse = {
    success: false,
    error: process.env['NODE_ENV'] === 'production' ? 'Error interno del servidor' : err.message,
  }

  res.status(500).json(response)
}

export function notFound(_req: Request, res: Response): void {
  const response: ApiResponse = { success: false, error: 'Ruta no encontrada' }
  res.status(404).json(response)
}
