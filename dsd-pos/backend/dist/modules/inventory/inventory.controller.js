"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIngredients = getIngredients;
exports.createIngredient = createIngredient;
exports.updateIngredient = updateIngredient;
exports.getLowStock = getLowStock;
exports.getRecipe = getRecipe;
exports.saveRecipe = saveRecipe;
exports.getMovements = getMovements;
exports.addMovement = addMovement;
exports.deductInventoryForOrder = deductInventoryForOrder;
const zod_1 = require("zod");
const supabase_1 = require("../../config/supabase");
const sendError_1 = require("../../utils/sendError");
const ingredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    unit: zod_1.z.string().min(1),
    stock: zod_1.z.number().min(0).default(0),
    min_stock: zod_1.z.number().min(0).default(0),
    cost_per_unit: zod_1.z.number().min(0).default(0),
    category: zod_1.z.string().optional(),
});
// ── Ingredientes ──────────────────────────────────────────────
async function getIngredients(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('ingredients')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true)
        .order('name');
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function createIngredient(req, res) {
    const parsed = ingredientSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('ingredients')
        .insert({ ...parsed.data, tenant_id: req.user.tenantId })
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.status(201).json({ success: true, data });
}
async function updateIngredient(req, res) {
    const parsed = ingredientSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { data, error } = await supabase_1.supabase
        .from('ingredients')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
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
async function getLowStock(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('ingredients')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    const low = (data ?? []).filter(i => Number(i.stock) <= Number(i.min_stock));
    res.json({ success: true, data: low });
}
// ── Recetas ───────────────────────────────────────────────────
async function getRecipe(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('recipes')
        .select('*, ingredients(id, name, unit, stock)')
        .eq('product_id', req.params['productId'])
        .eq('tenant_id', req.user.tenantId);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function saveRecipe(req, res) {
    const schema = zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({
            ingredient_id: zod_1.z.string().uuid(),
            quantity: zod_1.z.number().positive(),
            unit: zod_1.z.string().min(1),
        })),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const productId = req.params['productId'];
    // Borrar receta existente y reemplazar
    await supabase_1.supabase.from('recipes').delete().eq('product_id', productId).eq('tenant_id', req.user.tenantId);
    if (parsed.data.items.length > 0) {
        const { error } = await supabase_1.supabase.from('recipes').insert(parsed.data.items.map(item => ({
            tenant_id: req.user.tenantId,
            product_id: productId,
            ingredient_id: item.ingredient_id,
            quantity: item.quantity,
            unit: item.unit,
        })));
        if (error) {
            (0, sendError_1.sendError)(res, 500, error);
            return;
        }
    }
    res.json({ success: true, message: 'Receta guardada' });
}
// ── Movimientos ───────────────────────────────────────────────
async function getMovements(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('inventory_movements')
        .select('*, ingredients(name, unit), users!created_by(full_name)')
        .eq('tenant_id', req.user.tenantId)
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
async function addMovement(req, res) {
    const schema = zod_1.z.object({
        ingredient_id: zod_1.z.string().uuid(),
        type: zod_1.z.enum(['in', 'out', 'adjustment', 'waste']),
        quantity: zod_1.z.number().positive(),
        notes: zod_1.z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
        return;
    }
    const { ingredient_id, type, quantity, notes } = parsed.data;
    // Registrar movimiento
    const { error: mvError } = await supabase_1.supabase.from('inventory_movements').insert({
        tenant_id: req.user.tenantId,
        ingredient_id,
        type,
        quantity,
        notes,
        created_by: req.user.userId,
    });
    if (mvError) {
        (0, sendError_1.sendError)(res, 500, mvError);
        return;
    }
    // Actualizar stock
    const { data: ingredient } = await supabase_1.supabase
        .from('ingredients')
        .select('stock')
        .eq('id', ingredient_id)
        .single();
    const currentStock = Number(ingredient?.stock ?? 0);
    const newStock = type === 'in'
        ? currentStock + quantity
        : type === 'out' || type === 'waste'
            ? currentStock - quantity
            : quantity; // adjustment = set directly
    const { data, error } = await supabase_1.supabase
        .from('ingredients')
        .update({ stock: Math.max(0, newStock), updated_at: new Date().toISOString() })
        .eq('id', ingredient_id)
        .eq('tenant_id', req.user.tenantId)
        .select()
        .single();
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
// ── Descuento automático por orden ───────────────────────────
async function deductInventoryForOrder(tenantId, orderId, items) {
    for (const item of items) {
        // Obtener receta del producto
        const { data: recipe } = await supabase_1.supabase
            .from('recipes')
            .select('ingredient_id, quantity')
            .eq('product_id', item.product_id)
            .eq('tenant_id', tenantId);
        if (!recipe || recipe.length === 0)
            continue;
        for (const r of recipe) {
            const needed = r.quantity * item.quantity;
            // Registrar movimiento de salida
            await supabase_1.supabase.from('inventory_movements').insert({
                tenant_id: tenantId,
                ingredient_id: r.ingredient_id,
                order_id: orderId,
                type: 'out',
                quantity: needed,
                notes: `Orden automática`,
            });
            // Descontar del stock
            const { data: ing } = await supabase_1.supabase
                .from('ingredients')
                .select('stock')
                .eq('id', r.ingredient_id)
                .single();
            const newStock = Math.max(0, Number(ing?.stock ?? 0) - needed);
            await supabase_1.supabase
                .from('ingredients')
                .update({ stock: newStock, updated_at: new Date().toISOString() })
                .eq('id', r.ingredient_id);
        }
    }
}
//# sourceMappingURL=inventory.controller.js.map