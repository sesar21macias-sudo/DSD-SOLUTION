-- Borra las 4 ventas de prueba de Mayela García Nice (seller 7): 2 ya
-- estaban canceladas, 2 seguían activas ("a abonos"). Ninguna es una venta
-- real. Se restituye el inventario de las que seguían activas —las
-- canceladas ya lo habían recuperado al cancelarse—, y los dos pedidos que
-- quedan sin venta vuelven a "pending".
--
-- Ninguna tenía puntos de por medio (points_awarded = 0, sin transacciones
-- de club), así que no hay nada que corregir ahí.

PRAGMA defer_foreign_keys = true;

-- Restituir inventario de las ventas activas (40, 42) antes de borrarlas.
UPDATE seller_inventory
SET stock = stock + 1, updated_at = datetime('now')
WHERE seller_id = 7 AND product_id = 88;   -- sale 40

UPDATE seller_inventory
SET stock = stock + 1, updated_at = datetime('now')
WHERE seller_id = 7 AND product_id = 34;   -- sale 42, item 1

UPDATE seller_inventory
SET stock = stock + 1, updated_at = datetime('now')
WHERE seller_id = 7 AND product_id = 27;   -- sale 42, item 2

DELETE FROM sale_payments WHERE sale_id IN (39, 40, 41, 42);
DELETE FROM sale_items WHERE sale_id IN (39, 40, 41, 42);
DELETE FROM inventory_movements WHERE seller_id = 7 AND reference_id IN (39, 40, 41, 42);
DELETE FROM sales WHERE id IN (39, 40, 41, 42);

UPDATE orders
SET status = 'pending', updated_at = datetime('now')
WHERE id IN (24, 25) AND seller_id = 7;
