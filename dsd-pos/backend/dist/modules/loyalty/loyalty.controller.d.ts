import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function listCustomers(req: AuthRequest, res: Response): Promise<void>;
export declare function getCustomerByPhone(req: AuthRequest, res: Response): Promise<void>;
export declare function listRewards(req: AuthRequest, res: Response): Promise<void>;
export declare function createReward(req: AuthRequest, res: Response): Promise<void>;
export declare function updateReward(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteReward(req: AuthRequest, res: Response): Promise<void>;
export declare function redeemReward(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=loyalty.controller.d.ts.map