"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWhatsAppMessage = processWhatsAppMessage;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const supabase_1 = require("../../config/supabase");
const uuid_1 = require("uuid");
const anthropic = new sdk_1.default({ apiKey: process.env['ANTHROPIC_API_KEY'] });
// ── Tools que Claude puede usar ───────────────────────────────
const tools = [
    {
        name: 'get_menu',
        description: 'Obtiene el menú completo del restaurante con precios actuales. Úsala cuando el cliente pregunte qué hay, qué tienen, el menú, precios, o cualquier pregunta sobre los platillos.',
        input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'create_order',
        description: 'Crea la orden en el sistema cuando el cliente confirma su pedido. SIEMPRE confirma con el cliente antes de llamar esta función.',
        input_schema: {
            type: 'object',
            properties: {
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            product_id: { type: 'string' },
                            name: { type: 'string' },
                            quantity: { type: 'number' },
                        },
                        required: ['product_id', 'name', 'quantity'],
                    },
                },
                customer_name: { type: 'string', description: 'Nombre del cliente' },
                order_type: { type: 'string', enum: ['delivery', 'takeout'], description: 'delivery = a domicilio, takeout = para llevar' },
                address: { type: 'string', description: 'Dirección si es delivery' },
                notes: { type: 'string', description: 'Notas especiales de la orden' },
            },
            required: ['items', 'customer_name', 'order_type'],
        },
    },
    {
        name: 'get_order_status',
        description: 'Consulta el estado actual de una orden por su número',
        input_schema: {
            type: 'object',
            properties: {
                order_number: { type: 'string' },
            },
            required: ['order_number'],
        },
    },
    {
        name: 'check_ingredient_availability',
        description: 'Verifica si hay stock de un platillo específico consultando el inventario',
        input_schema: {
            type: 'object',
            properties: {
                product_name: { type: 'string' },
            },
            required: ['product_name'],
        },
    },
];
// ── Ejecutar herramientas ─────────────────────────────────────
async function executeTool(toolName, toolInput, tenantId, phone) {
    if (toolName === 'get_menu') {
        const { data: categories } = await supabase_1.supabase
            .from('menu_categories')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('sort_order');
        const { data: products } = await supabase_1.supabase
            .from('menu_products')
            .select('id, name, description, price_mxn, category_id')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('name');
        if (!products || products.length === 0)
            return { result: 'No hay productos disponibles en este momento.' };
        const grouped = (categories ?? []).map(cat => {
            const items = products.filter(p => p.category_id === cat.id);
            if (items.length === 0)
                return '';
            const list = items.map(p => `  • ${p.name}: $${Number(p.price_mxn).toFixed(2)}${p.description ? ` — ${p.description}` : ''} [id:${p.id}]`).join('\n');
            return `*${cat.name}:*\n${list}`;
        }).filter(Boolean);
        return { result: grouped.join('\n\n') };
    }
    if (toolName === 'create_order') {
        const input = toolInput;
        const { data: products } = await supabase_1.supabase
            .from('menu_products')
            .select('id, price_mxn')
            .in('id', input.items.map(i => i.product_id))
            .eq('tenant_id', tenantId);
        const orderItems = input.items.map(item => {
            const p = products?.find(p => p.id === item.product_id);
            const price = p ? Number(p.price_mxn) : 0;
            return { id: (0, uuid_1.v4)(), product_id: item.product_id, quantity: item.quantity, unit_price: price, subtotal: price * item.quantity };
        });
        const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        const orderNumber = `WA-${Date.now().toString(36).toUpperCase()}`;
        const { data: order, error } = await supabase_1.supabase
            .from('orders')
            .insert({
            tenant_id: tenantId,
            order_number: orderNumber,
            type: input.order_type === 'delivery' ? 'delivery' : 'takeout',
            customer_name: input.customer_name,
            customer_phone: phone,
            notes: input.notes,
            currency: 'MXN',
            status: 'pending',
            subtotal,
            tax,
            total,
        })
            .select()
            .single();
        if (error || !order)
            return { result: 'Error al crear la orden, intenta de nuevo.' };
        await supabase_1.supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id, tenant_id: tenantId })));
        return {
            result: JSON.stringify({ order_id: order.id, order_number: orderNumber, total: total.toFixed(2), subtotal: subtotal.toFixed(2), tax: tax.toFixed(2) }),
            orderData: { order_id: order.id, order_number: orderNumber, total, tenant_id: tenantId, order_items: orderItems },
        };
    }
    if (toolName === 'get_order_status') {
        const { order_number } = toolInput;
        const { data: order } = await supabase_1.supabase
            .from('orders')
            .select('order_number, status, total, created_at')
            .eq('order_number', order_number)
            .eq('tenant_id', tenantId)
            .single();
        if (!order)
            return { result: 'No encontré esa orden. Verifica el número e intenta de nuevo.' };
        const statusMap = {
            pending: 'recibida, pendiente de preparación ⏳',
            confirmed: 'confirmada ✅',
            preparing: 'en preparación 🔥',
            ready: '¡lista para entregar! 🎉',
            delivered: 'entregada 📦',
            paid: 'pagada y cerrada ✅',
            cancelled: 'cancelada ❌',
        };
        return { result: `Orden *${order.order_number}*: ${statusMap[order.status] ?? order.status}\nTotal: $${Number(order.total).toFixed(2)} MXN` };
    }
    if (toolName === 'check_ingredient_availability') {
        const { product_name } = toolInput;
        const { data: product } = await supabase_1.supabase
            .from('menu_products')
            .select('id, name, is_active')
            .eq('tenant_id', tenantId)
            .ilike('name', `%${product_name}%`)
            .single();
        if (!product || !product.is_active)
            return { result: `Lo siento, ${product_name} no está disponible en este momento.` };
        return { result: `Sí tenemos ${product.name} disponible.` };
    }
    return { result: 'No pude procesar esa acción.' };
}
// ── Agente principal ──────────────────────────────────────────
async function processWhatsAppMessage(tenantId, tenantName, phone, customerMessage, history) {
    const { data: tenant } = await supabase_1.supabase
        .from('tenants')
        .select('name, address, city, phone')
        .eq('id', tenantId)
        .single();
    const systemPrompt = `Eres el asistente virtual de *${tenant?.name ?? tenantName}*, un restaurante mexicano. Tu nombre es "Asistente de ${tenant?.name}".

Eres una persona amable, inteligente y natural. Hablas en español mexicano casual, como si fuera una conversación real entre amigos. Puedes usar emojis con moderación.

*Información del restaurante:*
- Nombre: ${tenant?.name}
- Dirección: ${tenant?.address ?? 'Disponible en este chat'}
- Ciudad: ${tenant?.city ?? 'México'}
- Contacto: ${tenant?.phone ?? 'Este WhatsApp'}
- Métodos de pago: Efectivo, tarjeta (Visa/MC), transferencia bancaria
- Servicios: Para llevar, delivery en zona local
- Horarios: Lunes a Domingo 8am - 10pm

*Cómo debes comportarte:*
- Responde CUALQUIER pregunta del cliente, no solo sobre comida
- Si te preguntan algo que no sabes (como pronósticos del tiempo), responde de forma amigable que no tienes esa información pero que con gusto ayudas con lo del restaurante
- Sé proactivo: si alguien saluda, ofrece el menú
- Si el cliente está indeciso, recomienda platillos populares
- Recuerda el contexto de la conversación para no pedir info repetida
- Si ya tienes el nombre del cliente de mensajes anteriores, úsalo
- Para quejas o problemas, muestra empatía y ofrece solución
- Puedes hacer chistes ligeros o comentarios amigables si el cliente es informal

*Para tomar pedidos:*
1. Muestra el menú con get_menu() si lo piden o si parece que quieren ordenar
2. Ayuda al cliente a elegir si está indeciso
3. Confirma el pedido ANTES de crearlo: "¿Te confirmo: [lista de productos] por $X.XX. ¿Todo bien?"
4. Pide nombre si no lo tienes
5. Pregunta si es para llevar o delivery (si es delivery, pide dirección)
6. Crea la orden con create_order()
7. Confirma con número de orden y tiempo estimado (~20-30 min)

*Frases que debes entender como intención de ordenar:*
"quiero", "me das", "ponme", "dame", "quisiera", "me puedes traer", "para pedir", "voy a llevar"

*IMPORTANTE:* Nunca inventes precios. Siempre consulta get_menu() para precios reales.`;
    const messages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: customerMessage },
    ];
    let response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
    });
    let newOrder;
    // Agentic loop
    while (response.stop_reason === 'tool_use') {
        const toolUses = response.content.filter(b => b.type === 'tool_use');
        const toolResults = [];
        for (const toolUse of toolUses) {
            const { result, orderData } = await executeTool(toolUse.name, toolUse.input, tenantId, phone);
            if (orderData)
                newOrder = orderData;
            toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
        }
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });
        response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            tools,
            messages,
        });
    }
    const textBlock = response.content.find(b => b.type === 'text');
    return {
        reply: textBlock?.text ?? 'No pude procesar tu mensaje. Intenta de nuevo.',
        newOrder,
    };
}
//# sourceMappingURL=whatsapp.agent.js.map