"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.signup = signup;
exports.me = me;
exports.refreshToken = refreshToken;
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const supabase_1 = require("../../config/supabase");
const sendError_1 = require("../../utils/sendError");
const auditLog_1 = require("../../utils/auditLog");
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invÃ¡lido'),
    password: zod_1.z.string().min(6, 'ContraseÃ±a mÃ­nimo 6 caracteres'),
});
const signupSchema = zod_1.z.object({
    businessName: zod_1.z.string().min(2, 'El nombre del negocio es muy corto'),
    slug: zod_1.z.string()
        .min(3, 'La URL debe tener al menos 3 caracteres')
        .max(40)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones (ej: tacos-el-guero)'),
    currency: zod_1.z.enum(['MXN', 'USD']).default('MXN'),
    fullName: zod_1.z.string().min(2, 'El nombre es muy corto'),
    email: zod_1.z.string().email('Email inválido'),
    password: zod_1.z.string().min(6, 'Contraseña mínimo 6 caracteres'),
});
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, process.env['JWT_SECRET'], {
        expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
    });
}
async function login(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        const response = { success: false, error: parsed.error.issues[0]?.message };
        res.status(400).json(response);
        return;
    }
    const { email, password } = parsed.data;
    const { data: user, error } = await supabase_1.supabase
        .from('users')
        .select('id, email, password_hash, role, tenant_id, full_name, is_active')
        .eq('email', email)
        .single();
    if (error || !user) {
        const response = { success: false, error: 'Credenciales invÃ¡lidas' };
        res.status(401).json(response);
        return;
    }
    if (!user.is_active) {
        const response = { success: false, error: 'Usuario inactivo' };
        res.status(403).json(response);
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!valid) {
        const response = { success: false, error: 'Credenciales invÃ¡lidas' };
        res.status(401).json(response);
        return;
    }
    const payload = {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        email: user.email,
    };
    const token = signToken(payload);
    const response = {
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
    };
    res.json(response);
}
// Alta self-service de un negocio nuevo: crea el tenant y su primer usuario
// (tenant_admin) en un solo paso, sin intervención manual. Endpoint público.
async function signup(req, res) {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { businessName, slug, currency, fullName, email, password } = parsed.data;
    const { data: existingTenant } = await supabase_1.supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (existingTenant) {
        res.status(409).json({ success: false, error: 'Esa URL ya está en uso, elige otra' });
        return;
    }
    const { data: existingUser } = await supabase_1.supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existingUser) {
        res.status(409).json({ success: false, error: 'Ya existe una cuenta con ese correo' });
        return;
    }
    const { data: tenant, error: tenantError } = await supabase_1.supabase
        .from('tenants')
        .insert({ name: businessName, slug, currency, plan: 'basic', is_active: true })
        .select()
        .single();
    if (tenantError || !tenant) {
        (0, sendError_1.sendError)(res, 500, tenantError, 'No se pudo crear el negocio');
        return;
    }
    const password_hash = await bcryptjs_1.default.hash(password, 12);
    const { data: user, error: userError } = await supabase_1.supabase
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
        .single();
    if (userError || !user) {
        // No dejar un tenant huérfano si falla la creación del usuario admin
        await supabase_1.supabase.from('tenants').delete().eq('id', tenant.id);
        (0, sendError_1.sendError)(res, 500, userError, 'No se pudo crear el usuario administrador');
        return;
    }
    const payload = { userId: user.id, tenantId: tenant.id, role: user.role, email: user.email };
    const token = signToken(payload);
    res.status(201).json({
        success: true,
        data: {
            token,
            user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, tenantId: tenant.id },
            tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        },
    });
}
async function me(req, res) {
    const { data: user, error } = await supabase_1.supabase
        .from('users')
        .select('id, email, full_name, role, tenant_id, created_at')
        .eq('id', req.user.userId)
        .single();
    if (error || !user) {
        const response = { success: false, error: 'Usuario no encontrado' };
        res.status(404).json(response);
        return;
    }
    res.json({ success: true, data: user });
}
async function refreshToken(req, res) {
    const payload = {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
        email: req.user.email,
    };
    const token = signToken(payload);
    res.json({ success: true, data: { token } });
}
async function listUsers(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('users')
        .select('id, full_name, email, role, is_active, created_at')
        .eq('tenant_id', req.user.tenantId)
        .order('created_at', { ascending: false });
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo obtener la lista de usuarios');
        return;
    }
    res.json({ success: true, data });
}
async function createUser(req, res) {
    const schema = zod_1.z.object({
        full_name: zod_1.z.string().min(1),
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(6),
        role: zod_1.z.enum(['tenant_admin', 'manager', 'cashier', 'waiter', 'kitchen']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { full_name, email, password, role } = parsed.data;
    const password_hash = await bcryptjs_1.default.hash(password, 12);
    const { data, error } = await supabase_1.supabase
        .from('users')
        .insert({ tenant_id: req.user.tenantId, full_name, email, password_hash, role })
        .select('id, full_name, email, role, is_active')
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 400, error, 'No se pudo crear el usuario');
        return;
    }
    res.status(201).json({ success: true, data });
}
async function updateUser(req, res) {
    const { is_active, role } = req.body;
    const { data, error } = await supabase_1.supabase
        .from('users')
        .update({ is_active, role })
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .select('id, full_name, email, role, is_active')
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo actualizar el usuario');
        return;
    }
    if (role) {
        await (0, auditLog_1.logAudit)({
            tenantId: req.user.tenantId,
            userId: req.user.userId,
            action: 'user.role_change',
            entityType: 'user',
            entityId: req.params['id'],
            metadata: { newRole: role },
        });
    }
    res.json({ success: true, data });
}
//# sourceMappingURL=auth.controller.js.map