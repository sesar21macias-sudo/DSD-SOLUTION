import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function getCategories(req: AuthRequest, res: Response): Promise<void>;
export declare function createCategory(req: AuthRequest, res: Response): Promise<void>;
export declare function updateCategory(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteCategory(req: AuthRequest, res: Response): Promise<void>;
export declare function getProducts(req: AuthRequest, res: Response): Promise<void>;
export declare function getProduct(req: AuthRequest, res: Response): Promise<void>;
export declare function createProduct(req: AuthRequest, res: Response): Promise<void>;
export declare function updateProduct(req: AuthRequest, res: Response): Promise<void>;
export declare function getTables(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteProduct(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=menu.controller.d.ts.map