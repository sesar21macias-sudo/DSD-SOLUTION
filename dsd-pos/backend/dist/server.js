"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const menu_routes_1 = __importDefault(require("./modules/menu/menu.routes"));
const orders_routes_1 = __importDefault(require("./modules/orders/orders.routes"));
const payments_routes_1 = __importDefault(require("./modules/payments/payments.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const shift_routes_1 = __importDefault(require("./modules/shift/shift.routes"));
const inventory_routes_1 = __importDefault(require("./modules/inventory/inventory.routes"));
const public_routes_1 = __importDefault(require("./modules/public/public.routes"));
const mp_routes_1 = __importDefault(require("./modules/mercadopago/mp.routes"));
const stripe_routes_1 = __importDefault(require("./modules/stripe/stripe.routes"));
const whatsapp_routes_1 = __importDefault(require("./modules/whatsapp/whatsapp.routes"));
const loyalty_routes_1 = __importDefault(require("./modules/loyalty/loyalty.routes"));
const delivery_routes_1 = __importDefault(require("./modules/delivery/delivery.routes"));
const reservations_routes_1 = __importDefault(require("./modules/reservations/reservations.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Railway (y la mayoría de PaaS) están detrás de un proxy — sin esto, cosas como
// express-rate-limit ven la IP del proxy en vez de la IP real del cliente.
app.set('trust proxy', 1);
const allowedOrigins = (process.env['FRONTEND_URL'] ?? 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
    },
});
// Middleware
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use((0, cors_1.default)({
    origin(origin, callback) {
        // Sin Origin = curl, health checks, webhooks server-to-server (ej. Mercado Pago)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Origen no permitido por CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/menu', menu_routes_1.default);
app.use('/api/orders', orders_routes_1.default);
app.use('/api/payments', payments_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
app.use('/api/shift', shift_routes_1.default);
app.use('/api/inventory', inventory_routes_1.default);
app.use('/api/public', public_routes_1.default);
app.use('/api/mp', mp_routes_1.default);
app.use('/api/stripe', stripe_routes_1.default);
app.use('/api/whatsapp', whatsapp_routes_1.default);
app.use('/api/loyalty', loyalty_routes_1.default);
app.use('/api/delivery', delivery_routes_1.default);
app.use('/api/reservations', reservations_routes_1.default);
// Socket.io — real-time kitchen display. Solo lo usan las páginas autenticadas
// del dashboard (/pos/*); el flujo público de pago no depende de sockets.
exports.io.use((socket, next) => {
    const token = socket.handshake.auth?.['token'];
    if (!token) {
        next(new Error('Token requerido'));
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env['JWT_SECRET']);
        socket.data['tenantId'] = payload.tenantId;
        socket.data['userId'] = payload.userId;
        next();
    }
    catch {
        next(new Error('Token inválido'));
    }
});
exports.io.on('connection', (socket) => {
    const tenantId = socket.data['tenantId'];
    console.log(`[Socket] Client connected: ${socket.id} (tenant ${tenantId})`);
    socket.on('join:tenant', () => {
        // Ignora cualquier tenantId que mande el cliente: siempre usa el del JWT verificado
        socket.join(`tenant:${tenantId}`);
        console.log(`[Socket] ${socket.id} joined tenant:${tenantId}`);
    });
    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});
app.use(errorHandler_1.notFound);
app.use(errorHandler_1.errorHandler);
const PORT = process.env['PORT'] ?? 4000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 DSD POS Server running on http://0.0.0.0:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map