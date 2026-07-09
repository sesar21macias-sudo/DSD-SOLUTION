import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function getCurrentShift(req: AuthRequest, res: Response): Promise<void>;
export declare function openShift(req: AuthRequest, res: Response): Promise<void>;
export declare function closeShift(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=shift.controller.d.ts.map