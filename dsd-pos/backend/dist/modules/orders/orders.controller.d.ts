import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function getOrders(req: AuthRequest, res: Response): Promise<void>;
export declare function getOrder(req: AuthRequest, res: Response): Promise<void>;
export declare function createOrder(req: AuthRequest, res: Response): Promise<void>;
export declare function updateOrderStatus(req: AuthRequest, res: Response): Promise<void>;
export declare function addOrderItem(req: AuthRequest, res: Response): Promise<void>;
export declare function removeOrderItem(req: AuthRequest, res: Response): Promise<void>;
export declare function applyDiscount(req: AuthRequest, res: Response): Promise<void>;
export declare function mergeOrders(req: AuthRequest, res: Response): Promise<void>;
export declare function cancelOrder(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=orders.controller.d.ts.map