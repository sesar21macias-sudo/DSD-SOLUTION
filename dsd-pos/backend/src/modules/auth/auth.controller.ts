import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { ApiResponse, JwtPayload } from '../../types'
import { sendError } from '../../utils/sendError'
import { logAudit } from '../../utils/auditLog'

const loginSchema = z.object({
  email: z.string().email('Email invÃ¡lido'),
  password: z.string().min(6, 'ContraseÃ±a mÃ­nimo 6 caracteres'),
})

const signupSchema = z.object({
  businessName: z.string().min(2, 'El nombre del negocio es muy corto'),
  slug: z.string()
    .min(3, 'La URL debe tener al menos 3 caracteres')
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones (ej: tacos-el-guero)'),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  fullName: z.string().min(2, 'El nombre es muy corto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña mínimo 6 caracteres'),
})

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env['JWT_SECRET']!, {
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  } as jwt.SignOptions)
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    const response: ApiResponse = { success: false, error: parsed.error.issues[0]?.message }
    res.status(400).json(response)
    return
  }

  const { email, password } = parsed.data

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, role, tenant_id, full_name, is_active')
    .eq('email', email)
    .single()

  if (error || !user) {
    const response: ApiResponse = { success: false, error: 'Credenciales invÃ¡lidas' }
    res.status(401).json(response)
    return
  }

  if (!user.is_active) {
    const response: ApiResponse = { success: false, error: 'Usuario inactivo' }
    res.status(403).json(response)
    return
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    const response: ApiResponse = { success: false, error: 'Credenciales invÃ¡lidas' }
    res.status(401).json(response)
    return
  }

  const payload: JwtPayload = {
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: user.email,
  }

  const token = signToken(payload)

  const response: ApiResponse = {
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        tenantId: user.tenant_id,
      },
    },
  }
  res.json(response)
}

// Alta self-service de un negocio nuevo: crea el tenant y su primer usuario
// (tenant_admin) en un solo paso, sin intervención manual. Endpoint público.
export async function signup(req: Request, res: Response): Promise<void> {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return
  }

  const { businessName, slug, currency, fullName, email, password } = parsed.data

  const { data: existingTenant } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (existingTenant) { res.status(409).json({ success: false, error: 'Esa URL ya está en uso, elige otra' }); return }

  const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
  if (existingUser) { res.status(409).json({ success: false, error: 'Ya existe una cuenta con ese correo' }); return }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: businessName, slug, currency, plan: 'basic', is_active: true })
    .select()
    .single()

  if (tenantError || !tenant) { sendError(res, 500, tenantError, 'No se pudo crear el negocio'); return }

  const password_hash = await bcrypt.hash(password, 12)
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      tenant_id: tenant.id,
      email,
      password_hash,
      full_name: fullName,
      role: 'tenant_admin',
      is_active: true,
    })
    .select()
    .single()

  if (userError || !user) {
    // No dejar un tenant huérfano si falla la creación del usuario admin
    await supabase.from('tenants').delete().eq('id', tenant.id)
    sendError(res, 500, userError, 'No se pudo crear el usuario administrador')
    return
  }

  const payload: JwtPayload = { userId: user.id, tenantId: tenant.id, role: user.role, email: user.email }
  const token = signToken(payload)

  res.status(201).json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, tenantId: tenant.id },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    },
  })
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, tenant_id, created_at')
    .eq('id', req.user!.userId)
    .single()

  if (error || !user) {
    const response: ApiResponse = { success: false, error: 'Usuario no encontrado' }
    res.status(404).json(response)
    return
  }

  res.json({ success: true, data: user })
}

export async function refreshToken(req: AuthRequest, res: Response): Promise<void> {
  const payload: JwtPayload = {
    userId: req.user!.userId,
    tenantId: req.user!.tenantId,
    role: req.user!.role,
    email: req.user!.email,
  }
  const token = signToken(payload)
  res.json({ success: true, data: { token } })
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at')
    .eq('tenant_id', req.user!.tenantId)
    .order('created_at', { ascending: false })
  if (error) { sendError(res, 500, error, 'No se pudo obtener la lista de usuarios'); return }
  res.json({ success: true, data })
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  const schema = z.object({
    full_name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['tenant_admin', 'manager', 'cashier', 'waiter', 'kitchen']),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return }

  const { full_name, email, password, role } = parsed.data
  const password_hash = await bcrypt.hash(password, 12)

  const { data, error } = await supabase
    .from('users')
    .insert({ tenant_id: req.user!.tenantId, full_name, email, password_hash, role })
    .select('id, full_name, email, role, is_active')
    .single()

  if (error) { sendError(res, 400, error, 'No se pudo crear el usuario'); return }
  res.status(201).json({ success: true, data })
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  const { is_active, role } = req.body
  const { data, error } = await supabase
    .from('users')
    .update({ is_active, role })
    .eq('id', req.params['id'])
    .eq('tenant_id', req.user!.tenantId)
    .select('id, full_name, email, role, is_active')
    .single()
  if (error) { sendError(res, 500, error, 'No se pudo actualizar el usuario'); return }

  if (role) {
    await logAudit({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      action: 'user.role_change',
      entityType: 'user',
      entityId: req.params['id'] as string,
      metadata: { newRole: role },
    })
  }

  res.json({ success: true, data })
}

