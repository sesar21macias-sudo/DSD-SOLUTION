-- Reinicio puntual, un solo uso: pedido el 2026-09-08.
--
-- Sesar Macias (seller 6) y Carlos Vaca (seller 8) eran cuentas de prueba:
-- se borran por completo, cuenta incluida.
--
-- Mayela Garcia Nice (seller 7) ya va a ser cliente real: su cuenta y su
-- tienda se conservan tal cual, solo se vacía lo que hasta ahora era
-- simulación —ventas, inventario, clientes, pedidos, puntos—, para que
-- empiece de cero con datos de verdad.
--
-- Se respaldó la base completa en backups/pre-reinicio-2026-09-08.sql antes
-- de correr esto.

PRAGMA defer_foreign_keys = true;

-- --- Sesar Macias (6) y Carlos Vaca (8): borrado total ----------------------

DELETE FROM loyalty_transactions WHERE account_id IN (
  SELECT id FROM loyalty_accounts WHERE seller_id IN (6, 8)
);
DELETE FROM loyalty_accounts WHERE seller_id IN (6, 8);
DELETE FROM loyalty_redemptions WHERE seller_id IN (6, 8);
DELETE FROM loyalty_rewards WHERE seller_id IN (6, 8);
DELETE FROM loyalty_programs WHERE seller_id IN (6, 8);

DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE seller_id IN (6, 8));
DELETE FROM sale_payments WHERE seller_id IN (6, 8);
DELETE FROM sales WHERE seller_id IN (6, 8);

DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE seller_id IN (6, 8));
DELETE FROM orders WHERE seller_id IN (6, 8);

DELETE FROM reception_items WHERE reception_id IN (
  SELECT id FROM receptions WHERE seller_id IN (6, 8)
);
DELETE FROM receptions WHERE seller_id IN (6, 8);

DELETE FROM inventory_movements WHERE seller_id IN (6, 8);
DELETE FROM seller_inventory WHERE seller_id IN (6, 8);
DELETE FROM stock_reservations WHERE seller_id IN (6, 8);
DELETE FROM seller_customers WHERE seller_id IN (6, 8);

DELETE FROM password_resets WHERE user_id IN (7, 9);

DELETE FROM sellers WHERE id IN (6, 8);
DELETE FROM users WHERE id IN (7, 9);

-- --- Mayela Garcia Nice (7): se queda la cuenta, se vacía la simulación -----
-- (loyalty_programs y loyalty_rewards NO se tocan: son su configuración,
-- no datos simulados.)

DELETE FROM loyalty_transactions WHERE account_id IN (
  SELECT id FROM loyalty_accounts WHERE seller_id = 7
);
DELETE FROM loyalty_accounts WHERE seller_id = 7;
DELETE FROM loyalty_redemptions WHERE seller_id = 7;

DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE seller_id = 7);
DELETE FROM sale_payments WHERE seller_id = 7;
DELETE FROM sales WHERE seller_id = 7;

DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE seller_id = 7);
DELETE FROM orders WHERE seller_id = 7;

DELETE FROM reception_items WHERE reception_id IN (
  SELECT id FROM receptions WHERE seller_id = 7
);
DELETE FROM receptions WHERE seller_id = 7;

DELETE FROM inventory_movements WHERE seller_id = 7;
DELETE FROM seller_inventory WHERE seller_id = 7;
DELETE FROM stock_reservations WHERE seller_id = 7;
DELETE FROM seller_customers WHERE seller_id = 7;

-- Con las tres cuentas resueltas (dos borradas, una sin clientes), no queda
-- ningún seller_customers vivo: la tabla global de contactos se puede vaciar
-- completa sin arriesgar el contacto de alguien más.
DELETE FROM customers;

DELETE FROM rate_limits;
