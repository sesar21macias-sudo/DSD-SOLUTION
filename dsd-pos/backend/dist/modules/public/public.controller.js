"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTableInfo = getTableInfo;
exports.getPublicTables = getPublicTables;
exports.getPublicMenu = getPublicMenu;
exports.createPublicOrder = createPublicOrder;
exports.createOnlineOrder = createOnlineOrder;
exports.identifyLoyaltyCustomer = identifyLoyaltyCustomer;
exports.setCustomerPin = setCustomerPin;
exports.loginCustomer = loginCustomer;
exports.getCustomerProfile = getCustomerProfile;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../../config/supabase");
const server_1 = require("../../server");
const sendError_1 = require("../../utils/sendError");
// ── Customer token helpers ────────────────────────────────────────────────────
function makeCustomerToken(customerId, tenantId, phone) {
    return jsonwebtoken_1.default.sign({ customerId, tenantId, phone, type: 'customer' }, process.env['JWT_SECRET'], { expiresIn: '30d' });
}
function decodeCustomerToken(token) {
    try {
        const p = jsonwebtoken_1.default.verify(token, process.env['JWT_SECRET']);
        if (p.type !== 'customer')
            return null;
        return { customerId: p.customerId, tenantId: p.tenantId, phone: p.phone };
    }
    catch {
        return null;
    }
}
// ── Tenant lookup helper ──────────────────────────────────────────────────────
async function getTenant(slug) {
    const { data } = await supabase_1.supabase.from('tenants').select('id, currency, tax_rate').eq('slug', slug).eq('is_active', true).single();
    return data;
}
// ── GET /api/public/table/:tenantSlug/:tableId ────────────────────────────────
async function getTableInfo(req, res) {
    const { tenantSlug, tableId } = req.params;
    const { data: tenant } = await supabase_1.supabase
        .from('tenants')
        .select('id, name, logo_url, currency')
        .eq('slug', tenantSlug)
        .eq('is_active', true)
        .single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const { data: table } = await supabase_1.supabase
        .from('tables')
        .select('id, number, name, capacity, status')
        .eq('id', tableId)
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .single();
    if (!table) {
        res.status(404).json({ success: false, error: 'Mesa no encontrada' });
        return;
    }
    res.json({ success: true, data: { tenant, table } });
}
// ── GET /api/public/tables/:tenantSlug ────────────────────────────────────────
async function getPublicTables(req, res) {
    const { tenantSlug } = req.params;
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('id').eq('slug', tenantSlug).eq('is_active', true).single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const { data: tables } = await supabase_1.supabase.from('tables').select('id, name, status').eq('tenant_id', tenant.id).eq('is_active', true).order('name');
    res.json({ success: true, data: tables ?? [] });
}
// ── GET /api/public/menu/:tenantSlug ─────────────────────────────────────────
async function getPublicMenu(req, res) {
    const { tenantSlug } = req.params;
    const { data: tenant } = await supabase_1.supabase
        .from('tenants')
        .select('id, name, logo_url, currency')
        .eq('slug', tenantSlug)
        .eq('is_active', true)
        .single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const { data: categories } = await supabase_1.supabase
        .from('menu_categories')
        .select('id, name, sort_order')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order');
    const { data: products } = await supabase_1.supabase
        .from('menu_products')
        .select('id, name, description, price_mxn, price_usd, image_url, category_id, preparation_time_min')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name');
    res.json({ success: true, data: { tenant, categories, products } });
}
// ── POST /api/public/order/:tenantSlug/:tableId ───────────────────────────────
async function createPublicOrder(req, res) {
    const { tenantSlug, tableId } = req.params;
    const schema = zod_1.z.object({
        customer_name: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            product_id: zod_1.z.string().uuid(),
            quantity: zod_1.z.number().int().positive(),
            notes: zod_1.z.string().optional(),
        })).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('id, currency, tax_rate').eq('slug', tenantSlug).single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const { data: table } = await supabase_1.supabase.from('tables').select('id, number').eq('id', tableId).eq('tenant_id', tenant.id).single();
    if (!table) {
        res.status(404).json({ success: false, error: 'Mesa no encontrada' });
        return;
    }
    const productIds = parsed.data.items.map(i => i.product_id);
    const { data: products } = await supabase_1.supabase.from('menu_products').select('id, name, price_mxn, price_usd, is_active').in('id', productIds).eq('tenant_id', tenant.id);
    const inactive = parsed.data.items.find(i => { const p = products?.find(p => p.id === i.product_id); return !p || !p.is_active; });
    if (inactive) {
        res.status(400).json({ success: false, error: 'Producto no disponible' });
        return;
    }
    const currency = tenant.currency ?? 'MXN';
    const orderItems = parsed.data.items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const unitPrice = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn;
        const subtotal = unitPrice * item.quantity;
        return { id: (0, uuid_1.v4)(), product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice, subtotal, notes: item.notes };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
    const taxRate = Number(tenant.tax_rate ?? 0.16);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const orderNumber = `QR-${Date.now().toString(36).toUpperCase()}`;
    const { data: order, error } = await supabase_1.supabase
        .from('orders')
        .insert({ tenant_id: tenant.id, order_number: orderNumber, type: 'dine_in', table_id: table.id, customer_name: parsed.data.customer_name, notes: parsed.data.notes, currency, status: 'pending', subtotal, tax, total })
        .select().single();
    if (error || !order) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo procesar la orden');
        return;
    }
    await supabase_1.supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: tenant.id })));
    server_1.io.to(`tenant:${tenant.id}`).emit('order:new', { ...order, order_items: orderItems, source: 'qr', table_number: table.number });
    res.status(201).json({ success: true, data: { order_number: orderNumber, total, currency } });
}
// ── POST /api/public/online-order/:tenantSlug ─────────────────────────────────
async function createOnlineOrder(req, res) {
    const tenantSlug = req.params['tenantSlug'];
    const schema = zod_1.z.object({
        customer_name: zod_1.z.string().min(1),
        customer_phone: zod_1.z.string().optional(),
        customer_token: zod_1.z.string().optional(),
        reward_id: zod_1.z.string().uuid().optional(),
        notes: zod_1.z.string().optional(),
        order_type: zod_1.z.enum(['takeout', 'delivery', 'dine_in']).default('takeout'),
        table_id: zod_1.z.string().uuid().optional(),
        require_payment: zod_1.z.boolean().optional().default(false),
        items: zod_1.z.array(zod_1.z.object({
            product_id: zod_1.z.string().uuid(),
            quantity: zod_1.z.number().int().positive(),
            notes: zod_1.z.string().optional(),
        })).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const tenant = await getTenant(tenantSlug);
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const productIds = parsed.data.items.map(i => i.product_id);
    const { data: products } = await supabase_1.supabase.from('menu_products').select('id, name, price_mxn, price_usd, is_active').in('id', productIds).eq('tenant_id', tenant.id);
    const inactive = parsed.data.items.find(i => { const p = products?.find(p => p.id === i.product_id); return !p || !p.is_active; });
    if (inactive) {
        res.status(400).json({ success: false, error: 'Producto no disponible' });
        return;
    }
    const currency = tenant.currency ?? 'MXN';
    const orderItems = parsed.data.items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const unitPrice = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn;
        const subtotal = unitPrice * item.quantity;
        return { id: (0, uuid_1.v4)(), product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice, subtotal, notes: item.notes };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
    const taxRate = Number(tenant.tax_rate ?? 0.16);
    const tax = subtotal * taxRate;
    let total = subtotal + tax;
    const orderNumber = `WEB-${Date.now().toString(36).toUpperCase()}`;
    // ── Apply reward discount ──────────────────────────────────────────────────
    let rewardDiscount = 0;
    let appliedRewardId = null;
    let rewardCustomerId = null;
    let pointsToDeduct = 0;
    if (parsed.data.reward_id && parsed.data.customer_token) {
        const custPayload = decodeCustomerToken(parsed.data.customer_token);
        if (custPayload && custPayload.tenantId === tenant.id) {
            const { data: custData } = await supabase_1.supabase.from('loyalty_customers').select('id, points').eq('id', custPayload.customerId).eq('tenant_id', tenant.id).single();
            const { data: reward } = await supabase_1.supabase.from('loyalty_rewards').select('id, points_required, reward_type, reward_value').eq('id', parsed.data.reward_id).eq('tenant_id', tenant.id).eq('is_active', true).single();
            if (custData && reward && custData.points >= reward.points_required) {
                if (reward.reward_type === 'discount')
                    rewardDiscount = Math.min(Number(reward.reward_value ?? 0), total);
                if (reward.reward_type === 'percentage')
                    rewardDiscount = Math.min((subtotal * Number(reward.reward_value ?? 0)) / 100, total);
                appliedRewardId = reward.id;
                rewardCustomerId = custData.id;
                pointsToDeduct = reward.points_required;
                total = Math.max(0, total - rewardDiscount);
            }
        }
    }
    const requirePayment = parsed.data.require_payment;
    const orderStatus = requirePayment ? 'pending_payment' : 'pending';
    const { data: order, error } = await supabase_1.supabase
        .from('orders')
        .insert({
        tenant_id: tenant.id,
        order_number: orderNumber,
        type: parsed.data.order_type,
        table_id: parsed.data.table_id ?? null,
        customer_name: parsed.data.customer_name,
        notes: parsed.data.notes,
        customer_phone: parsed.data.customer_phone?.replace(/\D/g, '') ?? null,
        currency,
        status: orderStatus,
        subtotal,
        tax,
        total,
    })
        .select().single();
    if (error || !order) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo procesar la orden');
        return;
    }
    await supabase_1.supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: tenant.id })));
    // Deduct loyalty points if reward was applied
    if (appliedRewardId && rewardCustomerId && pointsToDeduct > 0) {
        const { data: cust } = await supabase_1.supabase.from('loyalty_customers').select('points').eq('id', rewardCustomerId).single();
        if (cust) {
            await supabase_1.supabase.from('loyalty_customers').update({ points: Math.max(0, cust.points - pointsToDeduct) }).eq('id', rewardCustomerId);
            await supabase_1.supabase.from('loyalty_transactions').insert({
                tenant_id: tenant.id,
                customer_id: rewardCustomerId,
                order_id: order.id,
                points_redeemed: pointsToDeduct,
                description: 'Canje de recompensa en orden',
            });
        }
    }
    if (!requirePayment) {
        server_1.io.to(`tenant:${tenant.id}`).emit('order:new', { ...order, order_items: orderItems, source: 'web' });
    }
    res.status(201).json({ success: true, data: { order_id: order.id, order_number: orderNumber, total, currency, discount: rewardDiscount } });
}
// ── POST /api/public/loyalty/identify/:tenantSlug ─────────────────────────────
async function identifyLoyaltyCustomer(req, res) {
    const { tenantSlug } = req.params;
    const schema = zod_1.z.object({ phone: zod_1.z.string().min(7), name: zod_1.z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('id').eq('slug', tenantSlug).eq('is_active', true).single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
        return;
    }
    const phone = parsed.data.phone.replace(/\D/g, '');
    const { data: existing } = await supabase_1.supabase
        .from('loyalty_customers')
        .select('id, full_name, points, total_visits, tier, pin')
        .eq('tenant_id', tenant.id).eq('phone', phone).maybeSingle();
    if (existing) {
        if (parsed.data.name && !existing.full_name) {
            await supabase_1.supabase.from('loyalty_customers').update({ full_name: parsed.data.name }).eq('id', existing.id);
            existing.full_name = parsed.data.name;
        }
        const has_pin = !!existing.pin;
        const { pin: _, ...customerData } = existing;
        res.json({ success: true, data: { customer: customerData, is_new: false, has_pin } });
        return;
    }
    const { data: customer, error } = await supabase_1.supabase
        .from('loyalty_customers')
        .insert({ tenant_id: tenant.id, phone, full_name: parsed.data.name ?? null, points: 0, total_visits: 0, total_spent: 0, tier: 'bronze' })
        .select('id, full_name, points, total_visits, tier')
        .single();
    if (error || !customer) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo registrar el cliente');
        return;
    }
    res.status(201).json({ success: true, data: { customer, is_new: true, has_pin: false } });
}
// ── POST /api/public/loyalty/set-pin/:tenantSlug ─────────────────────────────
async function setCustomerPin(req, res) {
    const { tenantSlug } = req.params;
    const schema = zod_1.z.object({ phone: zod_1.z.string().min(7), pin: zod_1.z.string().length(4).regex(/^\d{4}$/) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('id').eq('slug', tenantSlug).eq('is_active', true).single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
        return;
    }
    const phone = parsed.data.phone.replace(/\D/g, '');
    const { data: customer } = await supabase_1.supabase.from('loyalty_customers').select('id').eq('tenant_id', tenant.id).eq('phone', phone).maybeSingle();
    if (!customer) {
        res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        return;
    }
    const pin = bcryptjs_1.default.hashSync(parsed.data.pin, 10);
    await supabase_1.supabase.from('loyalty_customers').update({ pin }).eq('id', customer.id);
    const token = makeCustomerToken(customer.id, tenant.id, phone);
    res.json({ success: true, data: { token } });
}
// ── POST /api/public/loyalty/login/:tenantSlug ────────────────────────────────
async function loginCustomer(req, res) {
    const { tenantSlug } = req.params;
    const schema = zod_1.z.object({ phone: zod_1.z.string().min(7), pin: zod_1.z.string().length(4) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('id').eq('slug', tenantSlug).eq('is_active', true).single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
        return;
    }
    const phone = parsed.data.phone.replace(/\D/g, '');
    const { data: customer } = await supabase_1.supabase
        .from('loyalty_customers')
        .select('id, full_name, points, total_visits, total_spent, tier, pin')
        .eq('tenant_id', tenant.id).eq('phone', phone).maybeSingle();
    if (!customer) {
        res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        return;
    }
    if (!customer.pin) {
        res.status(400).json({ success: false, error: 'Este cliente no tiene PIN configurado' });
        return;
    }
    if (!bcryptjs_1.default.compareSync(parsed.data.pin, customer.pin)) {
        res.status(401).json({ success: false, error: 'PIN incorrecto' });
        return;
    }
    const token = makeCustomerToken(customer.id, tenant.id, phone);
    const { pin: _, ...customerData } = customer;
    res.json({ success: true, data: { token, customer: customerData } });
}
// ── GET /api/public/loyalty/profile/:tenantSlug ───────────────────────────────
async function getCustomerProfile(req, res) {
    const { tenantSlug } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ success: false, error: 'Token requerido' });
        return;
    }
    const payload = decodeCustomerToken(token);
    if (!payload) {
        res.status(401).json({ success: false, error: 'Token invalido' });
        return;
    }
    const { data: tenant } = await supabase_1.supabase.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!tenant || tenant.id !== payload.tenantId) {
        res.status(403).json({ success: false, error: 'Acceso denegado' });
        return;
    }
    const [{ data: customer }, { data: rewards }, { data: transactions }] = await Promise.all([
        supabase_1.supabase.from('loyalty_customers').select('id, full_name, points, total_visits, total_spent, tier').eq('id', payload.customerId).single(),
        supabase_1.supabase.from('loyalty_rewards').select('id, name, description, points_required, reward_type, reward_value').eq('tenant_id', payload.tenantId).eq('is_active', true).order('points_required'),
        supabase_1.supabase.from('loyalty_transactions').select('id, points_earned, points_redeemed, description, created_at').eq('customer_id', payload.customerId).order('created_at', { ascending: false }).limit(10),
    ]);
    if (!customer) {
        res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        return;
    }
    const available_rewards = (rewards ?? []).filter(r => customer.points >= r.points_required);
    res.json({ success: true, data: { customer, all_rewards: rewards ?? [], available_rewards, transactions: transactions ?? [] } });
}
//# sourceMappingURL=public.controller.js.map