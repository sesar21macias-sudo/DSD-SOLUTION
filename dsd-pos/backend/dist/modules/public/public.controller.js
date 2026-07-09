"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTableInfo = getTableInfo;
exports.getPublicTables = getPublicTables;
exports.getPublicMenu = getPublicMenu;
exports.createPublicOrder = createPublicOrder;
exports.createOnlineOrder = createOnlineOrder;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const supabase_1 = require("../../config/supabase");
const server_1 = require("../../server");
const sendError_1 = require("../../utils/sendError");
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
    const { data: tenant } = await supabase_1.supabase
        .from('tenants')
        .select('id, currency, tax_rate')
        .eq('slug', tenantSlug)
        .single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const { data: table } = await supabase_1.supabase
        .from('tables')
        .select('id, number')
        .eq('id', tableId)
        .eq('tenant_id', tenant.id)
        .single();
    if (!table) {
        res.status(404).json({ success: false, error: 'Mesa no encontrada' });
        return;
    }
    // Obtener precios de productos
    const productIds = parsed.data.items.map(i => i.product_id);
    const { data: products } = await supabase_1.supabase
        .from('menu_products')
        .select('id, name, price_mxn, price_usd, is_active')
        .in('id', productIds)
        .eq('tenant_id', tenant.id);
    const inactive = parsed.data.items.find(i => {
        const p = products?.find(p => p.id === i.product_id);
        return !p || !p.is_active;
    });
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
        .insert({
        tenant_id: tenant.id,
        order_number: orderNumber,
        type: 'dine_in',
        table_id: table.id,
        customer_name: parsed.data.customer_name,
        notes: parsed.data.notes,
        currency,
        status: 'pending',
        subtotal,
        tax,
        total,
    })
        .select()
        .single();
    if (error || !order) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo procesar la orden');
        return;
    }
    await supabase_1.supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: tenant.id })));
    // Notificar a cocina y caja en tiempo real
    server_1.io.to(`tenant:${tenant.id}`).emit('order:new', {
        ...order,
        order_items: orderItems,
        source: 'qr',
        table_number: table.number,
    });
    res.status(201).json({ success: true, data: { order_number: orderNumber, total, currency } });
}
async function createOnlineOrder(req, res) {
    const { tenantSlug } = req.params;
    const schema = zod_1.z.object({
        customer_name: zod_1.z.string().min(1),
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
    const { data: tenant } = await supabase_1.supabase
        .from('tenants')
        .select('id, currency, tax_rate')
        .eq('slug', tenantSlug)
        .single();
    if (!tenant) {
        res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        return;
    }
    const productIds = parsed.data.items.map(i => i.product_id);
    const { data: products } = await supabase_1.supabase
        .from('menu_products')
        .select('id, name, price_mxn, price_usd, is_active')
        .in('id', productIds)
        .eq('tenant_id', tenant.id);
    const inactive = parsed.data.items.find(i => {
        const p = products?.find(p => p.id === i.product_id);
        return !p || !p.is_active;
    });
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
    const orderNumber = `WEB-${Date.now().toString(36).toUpperCase()}`;
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
        currency,
        status: orderStatus,
        subtotal,
        tax,
        total,
    })
        .select()
        .single();
    if (error || !order) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo procesar la orden');
        return;
    }
    await supabase_1.supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: tenant.id })));
    if (!requirePayment) {
        server_1.io.to(`tenant:${tenant.id}`).emit('order:new', {
            ...order,
            order_items: orderItems,
            source: 'web',
        });
    }
    res.status(201).json({ success: true, data: { order_id: order.id, order_number: orderNumber, total, currency } });
}
//# sourceMappingURL=public.controller.js.map