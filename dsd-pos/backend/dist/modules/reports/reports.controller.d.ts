import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function getDailySummary(req: AuthRequest, res: Response): Promise<void>;
export declare function getTopProducts(req: AuthRequest, res: Response): Promise<void>;
export declare function getTrends(req: AuthRequest, res: Response): Promise<void>;
export declare function getProductMix(req: AuthRequest, res: Response): Promise<void>;
export declare function getMargins(req: AuthRequest, res: Response): Promise<void>;
export declare function getSalesByHour(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=reports.controller.d.ts.map