import { Request, Response } from 'express';
declare module 'mercadopago' {
    interface PaymentCreateData {
        transaction_amount: number;
        token?: string;
        description?: string;
        installments?: number;
        payment_method_id?: string;
        issuer_id?: number;
        payer?: {
            email?: string;
            identification?: {
                type?: string;
                number?: string;
            };
        };
        external_reference?: string;
        notification_url?: string;
    }
}
export declare function getOrderForPayment(req: Request, res: Response): Promise<void>;
export declare function createPreference(req: Request, res: Response): Promise<void>;
export declare function mpWebhook(req: Request, res: Response): Promise<void>;
export declare function processCardPayment(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=mp.controller.d.ts.map