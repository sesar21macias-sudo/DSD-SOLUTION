import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function getSettings(req: AuthRequest, res: Response): Promise<void>;
export declare function upsertSettings(req: AuthRequest, res: Response): Promise<void>;
export declare function regenerateSecret(req: AuthRequest, res: Response): Promise<void>;
export declare function receiveWebhook(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=delivery.controller.d.ts.map