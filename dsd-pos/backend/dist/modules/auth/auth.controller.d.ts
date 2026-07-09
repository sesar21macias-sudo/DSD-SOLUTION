import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function login(req: Request, res: Response): Promise<void>;
export declare function signup(req: Request, res: Response): Promise<void>;
export declare function me(req: AuthRequest, res: Response): Promise<void>;
export declare function refreshToken(req: AuthRequest, res: Response): Promise<void>;
export declare function listUsers(req: AuthRequest, res: Response): Promise<void>;
export declare function createUser(req: AuthRequest, res: Response): Promise<void>;
export declare function updateUser(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map