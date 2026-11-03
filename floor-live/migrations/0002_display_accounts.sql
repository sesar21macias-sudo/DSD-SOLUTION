-- Cuentas de "pantalla": entran y solo muestran la pantalla de planta o de un equipo,
-- sin poder cambiar nada. Columna nueva (aditiva): no se reconstruye la tabla users,
-- así no se disparan los ON DELETE SET NULL de las tablas que apuntan a ella.
ALTER TABLE users ADD COLUMN display_only INTEGER NOT NULL DEFAULT 0;
