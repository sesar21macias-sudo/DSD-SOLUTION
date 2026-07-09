"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncoming = handleIncoming;
exports.getConversations = getConversations;
const twilio_1 = __importDefault(require("twilio"));
const supabase_1 = require("../../config/supabase");
const whatsapp_agent_1 = require("./whatsapp.agent");
const server_1 = require("../../server");
const sendError_1 = require("../../utils/sendError");
const twilioClient = (0, twilio_1.default)(process.env['TWILIO_ACCOUNT_SID'], process.env['TWILIO_AUTH_TOKEN']);
async function handleIncoming(req, res) {
    const { tenantSlug } = req.params;
    const { Body: body, From: from, ProfileName: profileName } = req.body;
    if (!body || !from) {
        res.status(400).send('Missing fields');
        return;
    }
    const phone = from.replace('whatsapp:', '');
    const customerMessage = body.trim();
    // Responder a Twilio inmediatamente para evitar timeout
    res.status(200).send('<Response></Response>');
    try {
        const { data: tenant } = await supabase_1.supabase
            .from('tenants')
            .select('id, name')
            .eq('slug', tenantSlug)
            .eq('is_active', true)
            .single();
        if (!tenant) {
            await sendWhatsApp(from, 'Lo sentimos, este servicio no está disponible.');
            return;
        }
        // Obtener historial de conversación
        const { data: conversation } = await supabase_1.supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('phone', phone)
            .single();
        const rawMessages = (conversation?.messages ?? []);
        const history = rawMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content }));
        // Procesar con Claude
        const { reply, newOrder } = await (0, whatsapp_agent_1.processWhatsAppMessage)(tenant.id, tenant.name, phone, customerMessage, history);
        // Si se creó una orden, emitir al POS en tiempo real
        if (newOrder) {
            server_1.io.to(`tenant:${newOrder.tenant_id}`).emit('order:new', {
                ...newOrder,
                source: 'whatsapp',
                tables: null,
            });
            console.log(`[WhatsApp] Nueva orden ${newOrder.order_number} enviada al POS`);
        }
        // Actualizar historial
        const updatedMessages = [
            ...history,
            { role: 'user', content: customerMessage },
            { role: 'assistant', content: reply },
        ].slice(-30);
        if (conversation) {
            await supabase_1.supabase
                .from('whatsapp_conversations')
                .update({
                messages: updatedMessages,
                customer_name: profileName ?? conversation.customer_name,
                last_message_at: new Date().toISOString(),
            })
                .eq('id', conversation.id);
        }
        else {
            await supabase_1.supabase
                .from('whatsapp_conversations')
                .insert({
                tenant_id: tenant.id,
                phone,
                customer_name: profileName,
                messages: updatedMessages,
            });
        }
        await sendWhatsApp(from, reply);
    }
    catch (err) {
        console.error('[WhatsApp Agent Error]', err);
        await sendWhatsApp(from, 'Tuve un problemita técnico 😅 Intenta de nuevo en un momento.');
    }
}
async function sendWhatsApp(to, message) {
    await twilioClient.messages.create({
        from: `whatsapp:${process.env['TWILIO_WHATSAPP_NUMBER']}`,
        to,
        body: message,
    });
}
async function getConversations(req, res) {
    const { data, error } = await supabase_1.supabase
        .from('whatsapp_conversations')
        .select('id, phone, customer_name, status, last_message_at, messages')
        .eq('tenant_id', req.user.tenantId)
        .order('last_message_at', { ascending: false })
        .limit(50);
    if (error) {
        (0, sendError_1.sendError)(res, 500, error);
        return;
    }
    res.json({ success: true, data });
}
//# sourceMappingURL=whatsapp.controller.js.map