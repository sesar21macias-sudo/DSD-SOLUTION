-- Fecha de cumpleanos para promociones dirigidas y para poder mandar
-- promociones por correo mas adelante.
ALTER TABLE loyalty_customers ADD COLUMN IF NOT EXISTS birthday date;
