-- Limpia la prueba end-to-end hecha en la cuenta de Mayela (seller 7) antes
-- de entregársela: la pieza de catálogo agregada, el pedido, la venta y la
-- clienta de prueba. El programa/recompensas de su club NO se tocan.

PRAGMA defer_foreign_keys = true;

DELETE FROM loyalty_transactions WHERE account_id IN (
  SELECT id FROM loyalty_accounts WHERE seller_id = 7
);
DELETE FROM loyalty_accounts WHERE seller_id = 7;

DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE seller_id = 7);
DELETE FROM sales WHERE seller_id = 7;

DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE seller_id = 7);
DELETE FROM orders WHERE seller_id = 7;

DELETE FROM inventory_movements WHERE seller_id = 7;
DELETE FROM seller_inventory WHERE seller_id = 7;
DELETE FROM stock_reservations WHERE seller_id = 7;
DELETE FROM seller_customers WHERE seller_id = 7;
DELETE FROM customers;

DELETE FROM rate_limits;
