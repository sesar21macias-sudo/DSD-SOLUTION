import { Request, Response, NextFunction } from 'express';
import { JwtPayload, UserRole } from '../types';
export interface AuthRequest extends Request {
    user?: JwtPayload;
}
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function authorize(...roles: UserRole[]): (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map