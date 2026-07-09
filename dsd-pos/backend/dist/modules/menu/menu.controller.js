"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategories = getCategories;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
exports.getProducts = getProducts;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.getTables = getTables;
exports.deleteProduct = deleteProduct;
const zod_1 = require("zod");
const supabase_1 = require("../../config/supabase");
const sendError_1 = require("../../utils/sendError");
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    sort_order: zod_1.z.number().int().default(0),
    is_active: zod_1.z.boolean().default(true),
});
const productSchema = zod_1.z.object({
    category_id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    price_mxn: zod_1.z.number().positive(),
    price_usd: zod_1.z.number().positive().optional(),
    sku: zod_1.z.string().optional(),
    image_url: zod_1.z.string().url().optional(),
    is_active: zod_1.z.boolean().default(true),
    track_inventory: zod_1.z.boolean().default(false),
    preparation_time_min: zod_1.z.number().int().min(0).default(10),
});
// â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getCategories(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('menu_categories')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true)
        .order('sort_order');
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function createCategory(req, res) {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('menu_categories')
        .insert({ ...parsed.data, tenant_id: req.user.tenantId })
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.status(201).json({ success: true, data });
}
async function updateCategory(req, res) {
    const parsed = categorySchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('menu_categories')
        .update(parsed.data)
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function deleteCategory(req, res) {
    const { error } = await supabase_1.supabase
        .from('menu_categories')
        .update({ is_active: false })
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, message: 'CategorÃ­a eliminada' });
}
// â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getProducts(req, res) {
    const { category_id } = req.query;
    let query = supabase_1.supabase
        .from('menu_products')
        .select('*, menu_categories(name)')
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true);
    if (category_id)
        query = query.eq('category_id', category_id);
    const { data, error } = await query.order('name');
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function getProduct(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('menu_products')
        .select('*, menu_categories(name)')
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .single();
    if (error || !data) {
        res.status(404).json({ success: false, error: 'Producto no encontrado' });
        return;
    }
    res.json({ success: true, data });
}
async function categoryBelongsToTenant(categoryId, tenantId) {
    const { data } = await supabase_1.supabase
        .from('menu_categories')
        .select('id')
        .eq('id', categoryId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
    return !!data;
}
async function createProduct(req, res) {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    if (!(await categoryBelongsToTenant(parsed.data.category_id, req.user.tenantId))) {
        res.status(400).json({ success: false, error: 'Categoría inválida' });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('menu_products')
        .insert({ ...parsed.data, tenant_id: req.user.tenantId })
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.status(201).json({ success: true, data });
}
async function updateProduct(req, res) {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    if (parsed.data.category_id && !(await categoryBelongsToTenant(parsed.data.category_id, req.user.tenantId))) {
        res.status(400).json({ success: false, error: 'Categoría inválida' });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('menu_products')
        .update(parsed.data)
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId)
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function getTables(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('tables')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true)
        .order('number');
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function deleteProduct(req, res) {
    const { error } = await supabase_1.supabase
        .from('menu_products')
        .update({ is_active: false })
        .eq('id', req.params['id'])
        .eq('tenant_id', req.user.tenantId);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, message: 'Producto eliminado' });
}
//# sourceMappingURL=menu.controller.js.map