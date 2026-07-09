"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrders = getOrders;
exports.getOrder = getOrder;
exports.createOrder = createOrder;
exports.updateOrderStatus = updateOrderStatus;
exports.addOrderItem = addOrderItem;
exports.removeOrderItem = removeOrderItem;
exports.applyDiscount = applyDiscount;
exports.mergeOrders = mergeOrders;
exports.cancelOrder = cancelOrder;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const supabase_1 = require("../../config/supabase");
const server_1 = require("../../server");
const inventory_controller_1 = require("../inventory/inventory.controller");
const auditLog_1 = require("../../utils/auditLog");
const sendError_1 = require("../../utils/sendError");
const createOrderSchema = zod_1.z.object({
    type: zod_1.z.enum(['dine_in', 'takeout', 'delivery', 'online']),
    table_id: zod_1.z.string().uuid().optional(),
    customer_name: zod_1.z.string().optional(),
    customer_phone: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    currency: zod_1.z.enum(['MXN', 'USD']).default('MXN'),
    items: zod_1.z.array(zod_1.z.object({
        product_id: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().optional(),
        modifiers: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            price: zod_1.z.number(),
        })).optional(),
    })).min(1),
});
const addItemSchema = zod_1.z.object({
    product_id: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().int().positive(),
    notes: zod_1.z.string().optional(),
});
async function getOrders(req, res) {
    const { status, date, type } = req.query;
    let query = supabase_1.supabase
        .from('orders')
        .select(`
      *,
      order_items(*, menu_products(name, image_url)),
      tables(number, name)
    `)
        .eq('tenant_id', req.user.tenantId)
        .order('created_at', { ascending: false })
        .limit(100);
    if (status)
        query = query.eq('status', status);
    if (type)
        query = query.eq('type', type);
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    }
    const { data, error } = await query;
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function getOrder(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('orders')
        .select(`
      *,
      order_items(*, menu_products(name, description, image_url)),
      tables(number, name),
      tenants(name, address, phone)
    `)
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .single();
    if (error || !data) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    res.json({ success: true, data });
}
async function createOrder(req, res) {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { items, ...orderData } = parsed.data;
    // Fetch product prices
    const productIds = items.map(i => i.product_id);
    const { data: products, error: prodError } = await supabase_1.supabase
        .from('menu_products')
        .select('id, name, price_mxn, price_usd, is_active')
        .in('id', productIds)
        .eq('tenant_id', req.user.tenantId);
    if (prodError || !products) {
        res.status(500).json({ success: false, error: 'Error al obtener productos' });
        return;
    }
    const inactiveOrMissing = items.find(i => {
        const p = products.find(p => p.id === i.product_id);
        return !p || !p.is_active;
    });
    if (inactiveOrMissing) {
        res.status(400).json({ success: false, error: 'Uno o mÃ¡s productos no estÃ¡n disponibles' });
        return;
    }
    const currency = orderData.currency;
    const orderItems = items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const unitPrice = currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn;
        const modifiersTotal = (item.modifiers ?? []).reduce((sum, m) => sum + m.price, 0);
        const subtotal = (unitPrice + modifiersTotal) * item.quantity;
        return {
            id: (0, uuid_1.v4)(),
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: unitPrice,
            modifiers: item.modifiers ?? [],
            notes: item.notes,
            subtotal,
        };
    });
    const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0);
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const { data: order, error: orderError } = await supabase_1.supabase
        .from('orders')
        .insert({
        ...orderData,
        tenant_id: req.user.tenantId,
        created_by: req.user.userId,
        order_number: orderNumber,
        status: 'pending',
        subtotal: total,
        tax: total * 0.16,
        total: total * 1.16,
    })
        .select()
        .single();
    if (orderError || !order) {
        (0, sendError_1.sendError)(res, 500, orderError, 'No se pudo crear la orden');
        return;
    }
    const { error: itemsError } = await supabase_1.supabase
        .from('order_items')
        .insert(orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: req.user.tenantId })));
    if (itemsError) {
        (0, sendError_1.sendError)(res, 500, itemsError, 'No se pudo crear la orden');
        return;
    }
    server_1.io.to(`tenant:${req.user.tenantId}`).emit('order:new', { ...order, order_items: orderItems });
    // Descontar inventario en segundo plano
    (0, inventory_controller_1.deductInventoryForOrder)(req.user.tenantId, order.id, items.map(i => ({ product_id: i.product_id, quantity: i.quantity }))).catch(err => console.error('[Inventory] Error descontando:', err));
    res.status(201).json({ success: true, data: { ...order, order_items: orderItems } });
}
async function updateOrderStatus(req, res) {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: 'Estado invÃ¡lido' });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .select()
        .single();
    if (error || !data) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    server_1.io.to(`tenant:${req.user.tenantId}`).emit('order:updated', data);
    res.json({ success: true, data });
}
async function addOrderItem(req, res) {
    const parsed = addItemSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data: order } = await supabase_1.supabase
        .from('orders')
        .select('id, currency, status')
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .single();
    if (!order) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    if (['paid', 'cancelled'].includes(order.status)) {
        res.status(400).json({ success: false, error: 'No se pueden agregar items a esta orden' });
        return;
    }
    const { data: product } = await supabase_1.supabase
        .from('menu_products')
        .select('id, price_mxn, price_usd')
        .eq('id', parsed.data.product_id)
        .eq('tenant_id', req.user.tenantId)
        .single();
    if (!product) {
        res.status(404).json({ success: false, error: 'Producto no encontrado' });
        return;
    }
    const unitPrice = order.currency === 'USD' ? (product.price_usd ?? product.price_mxn / 17) : product.price_mxn;
    const subtotal = unitPrice * parsed.data.quantity;
    const { data: item, error } = await supabase_1.supabase
        .from('order_items')
        .insert({
        order_id: order.id,
        tenant_id: req.user.tenantId,
        product_id: parsed.data.product_id,
        quantity: parsed.data.quantity,
        unit_price: unitPrice,
        subtotal,
        notes: parsed.data.notes,
    })
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    // Recalculate order total
    const { data: allItems } = await supabase_1.supabase
        .from('order_items')
        .select('subtotal')
        .eq('order_id', order.id);
    const newSubtotal = (allItems ?? []).reduce((sum, i) => sum + i.subtotal, 0);
    await supabase_1.supabase.from('orders').update({
        subtotal: newSubtotal,
        tax: newSubtotal * 0.16,
        total: newSubtotal * 1.16,
    }).eq('id', order.id);
    res.status(201).json({ success: true, data: item });
}
async function removeOrderItem(req, res) {
    const { error, count } = await supabase_1.supabase
        .from('order_items')
        .delete({ count: 'exact' })
        .eq('id', req.params['itemId'])
        .eq('order_id', req.params['id'])
        .eq('tenant_id', req.user.tenantId);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    if (!count) {
        res.status(404).json({ success: false, error: 'Item no encontrado' });
        return;
    }
    await (0, auditLog_1.logAudit)({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        action: 'order.item_remove',
        entityType: 'order_item',
        entityId: req.params['itemId'],
        metadata: { orderId: req.params['id'] },
    });
    res.json({ success: true, message: 'Item eliminado' });
}
const discountSchema = zod_1.z.object({
    type: zod_1.z.enum(['amount', 'percentage']),
    value: zod_1.z.number().min(0),
    reason: zod_1.z.string().optional(),
});
// Aplica (o quita, con value: 0) un descuento manual a una orden antes de cobrarla.
// El descuento se calcula sobre el subtotal (antes de IVA) y nunca puede dejar el
// total en negativo.
async function applyDiscount(req, res) {
    const parsed = discountSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { type, value, reason } = parsed.data;
    const { data: order } = await supabase_1.supabase
        .from('orders')
        .select('id, subtotal, status')
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .single();
    if (!order) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    if (['paid', 'cancelled'].includes(order.status)) {
        res.status(400).json({ success: false, error: 'No se puede aplicar descuento a una orden pagada o cancelada' });
        return;
    }
    const subtotal = Number(order.subtotal);
    const rawDiscount = type === 'percentage' ? subtotal * (Math.min(value, 100) / 100) : value;
    const discount = Math.round(Math.min(rawDiscount, subtotal) * 100) / 100;
    const taxableAmount = subtotal - discount;
    const tax = Math.round(taxableAmount * 0.16 * 100) / 100;
    const total = Math.round((taxableAmount + tax) * 100) / 100;
    const { data: updated, error } = await supabase_1.supabase
        .from('orders')
        .update({ discount, tax, total, updated_at: new Date().toISOString() })
        .eq('id', req.params['id'])
        .select()
        .single();
    if (error || !updated) {
        (0, sendError_1.sendError)(res, 500, error, 'No se pudo aplicar el descuento');
        return;
    }
    await (0, auditLog_1.logAudit)({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        action: 'order.discount',
        entityType: 'order',
        entityId: req.params['id'],
        metadata: { type, value, discount, reason },
    });
    server_1.io.to(`tenant:${req.user.tenantId}`).emit('order:updated', updated);
    res.json({ success: true, data: updated });
}
const mergeSchema = zod_1.z.object({
    source_order_id: zod_1.z.string().uuid(),
});
// Fusiona dos cuentas activas en una sola (ej. dos órdenes distintas en la misma
// mesa, o de dos mesas que se van a pagar juntas). Mueve los items de la orden
// origen a la destino, recalcula totales, y cancela la orden origen.
async function mergeOrders(req, res) {
    const parsed = mergeSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const targetId = req.params['id'];
    const { source_order_id } = parsed.data;
    if (source_order_id === targetId) {
        res.status(400).json({ success: false, error: 'No puedes fusionar una orden consigo misma' });
        return;
    }
    const { data: orders } = await supabase_1.supabase
        .from('orders')
        .select('id, status, currency, table_id')
        .in('id', [targetId, source_order_id])
        .eq('tenant_id', req.user.tenantId);
    const target = orders?.find(o => o.id === targetId);
    const source = orders?.find(o => o.id === source_order_id);
    if (!target || !source) {
        res.status(404).json({ success: false, error: 'Orden no encontrada' });
        return;
    }
    if (['paid', 'cancelled'].includes(target.status) || ['paid', 'cancelled'].includes(source.status)) {
        res.status(400).json({ success: false, error: 'No se pueden fusionar órdenes pagadas o canceladas' });
        return;
    }
    if (target.currency !== source.currency) {
        res.status(400).json({ success: false, error: 'No se pueden fusionar órdenes en distinta moneda' });
        return;
    }
    const { error: moveError } = await supabase_1.supabase
        .from('order_items')
        .update({ order_id: targetId })
        .eq('order_id', source_order_id)
        .eq('tenant_id', req.user.tenantId);
    if (moveError) {
        (0, sendError_1.sendError)(res, 500, moveError, 'No se pudo fusionar la cuenta');
        return;
    }
    const { data: allItems } = await supabase_1.supabase.from('order_items').select('subtotal').eq('order_id', targetId);
    const newSubtotal = (allItems ?? []).reduce((sum, i) => sum + Number(i.subtotal), 0);
    const { data: updatedTarget, error: updateError } = await supabase_1.supabase
        .from('orders')
        .update({
        subtotal: newSubtotal,
        tax: newSubtotal * 0.16,
        total: newSubtotal * 1.16,
        updated_at: new Date().toISOString(),
    })
        .eq('id', targetId)
        .select('*, order_items(*, menu_products(name, image_url)), tables(number, name)')
        .single();
    if (updateError || !updatedTarget) {
        (0, sendError_1.sendError)(res, 500, updateError, 'No se pudo fusionar la cuenta');
        return;
    }
    await supabase_1.supabase.from('orders').update({
        status: 'cancelled',
        cancellation_reason: `Fusionada con orden ${targetId}`,
        updated_at: new Date().toISOString(),
    }).eq('id', source_order_id);
    if (source.table_id && source.table_id !== target.table_id) {
        await supabase_1.supabase.from('tables').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', source.table_id);
    }
    await (0, auditLog_1.logAudit)({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        action: 'order.merge',
        entityType: 'order',
        entityId: targetId,
        metadata: { sourceOrderId: source_order_id },
    });
    server_1.io.to(`tenant:${req.user.tenantId}`).emit('order:updated', updatedTarget);
    res.json({ success: true, data: updatedTarget });
}
async function cancelOrder(req, res) {
    const { reason } = req.body;
    const { data, error } = await supabase_1.supabase
        .from('orders')
        .update({ status: 'cancelled', cancellation_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .not('status', 'in', '("paid","cancelled")')
        .select()
        .single();
    if (error || !data) {
        res.status(400).json({ success: false, error: 'No se puede cancelar esta orden' });
        return;
    }
    await (0, auditLog_1.logAudit)({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        action: 'order.cancel',
        entityType: 'order',
        entityId: data.id,
        metadata: { reason },
    });
    res.json({ success: true, data });
}
//# sourceMappingURL=orders.controller.js.map