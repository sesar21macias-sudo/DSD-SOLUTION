-- Vacía los datos de demostración de la base.
--
-- Se conservan:
--   · las categorías (son la estructura, no datos de prueba);
--   · las piezas traídas del catálogo real de NICE —se reconocen porque su
--     foto vive en el CDN de Shopify—, porque el catálogo es global y esas
--     ya sirven para cualquier distribuidora que las reciba;
--   · las cuentas de administración.
--
-- Se borra todo lo demás: distribuidoras de prueba, sus inventarios, clientes,
-- ventas, pedidos, recepciones y las piezas inventadas para la demo.
--
-- D1 guarda 30 días de Time Travel: si esto se ejecutó por error, se puede
-- volver atrás con `wrangler d1 time-travel restore`.

PRAGMA defer_foreign_keys = true;

DELETE FROM loyalty_transactions;
DELETE FROM loyalty_accounts;
DELETE FROM sale_items;
DELETE FROM sales;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM order_counters;
DELETE FROM reception_items;
DELETE FROM receptions;
DELETE FROM inventory_movements;
DELETE FROM seller_inventory;
DELETE FROM seller_customers;
DELETE FROM customers;
DELETE FROM sellers;
DELETE FROM users WHERE role <> 'admin';
DELETE FROM rate_limits;

-- Las piezas de la demo llevan su ilustración como data URI; las reales de
-- NICE apuntan al CDN de Shopify.
DELETE FROM products WHERE image_url IS NULL OR image_url NOT LIKE 'https://cdn.shopify.com/%';
