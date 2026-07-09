export type UserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
export type Currency = 'MXN' | 'USD';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';
export type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'online';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'online';
export interface JwtPayload {
    userId: string;
    tenantId: string;
    role: UserRole;
    email: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
//# sourceMappingURL=index.d.ts.map