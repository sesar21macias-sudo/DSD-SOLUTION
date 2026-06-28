import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JwtPayload, UserRole, ApiResponse } from '../types'

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    const response: ApiResponse = { success: false, error: 'Token requerido' }
    res.status(401).json(response)
    return
  }

  try {
    const payload = jwt.verify(token, process.env['JWT_SECRET']!) as JwtPayload
    req.user = payload
    next()
  } catch {
    const response: ApiResponse = { success: false, error: 'Token inválido o expirado' }
    res.status(401).json(response)
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      const response: ApiResponse = { success: false, error: 'No tienes permisos para esta acción' }
      res.status(403).json(response)
      return
    }
    next()
  }
}
