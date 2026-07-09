import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare function getIngredients(req: AuthRequest, res: Response): Promise<void>;
export declare function createIngredient(req: AuthRequest, res: Response): Promise<void>;
export declare function updateIngredient(req: AuthRequest, res: Response): Promise<void>;
export declare function getLowStock(req: AuthRequest, res: Response): Promise<void>;
export declare function getRecipe(req: AuthRequest, res: Response): Promise<void>;
export declare function saveRecipe(req: AuthRequest, res: Response): Promise<void>;
export declare function getMovements(req: AuthRequest, res: Response): Promise<void>;
export declare function addMovement(req: AuthRequest, res: Response): Promise<void>;
export declare function deductInventoryForOrder(tenantId: string, orderId: string, items: {
    product_id: string;
    quantity: number;
}[]): Promise<void>;
//# sourceMappingURL=inventory.controller.d.ts.map