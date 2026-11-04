-- Cómo se ve cada cosa en la tele, ajustable desde el panel (columnas nuevas, aditivas).

-- Fotos: llenar la pantalla o mostrarla completa, punto de enfoque (0-100 %),
-- color de fondo (para "completa" y para zonas transparentes de un PNG),
-- movimiento lento sí/no y segundos propios (NULL = los de la pantalla).
ALTER TABLE media ADD COLUMN fit TEXT NOT NULL DEFAULT 'cover';
ALTER TABLE media ADD COLUMN pos_x INTEGER NOT NULL DEFAULT 50;
ALTER TABLE media ADD COLUMN pos_y INTEGER NOT NULL DEFAULT 50;
ALTER TABLE media ADD COLUMN bg TEXT NOT NULL DEFAULT 'black';
ALTER TABLE media ADD COLUMN motion INTEGER NOT NULL DEFAULT 1;
ALTER TABLE media ADD COLUMN seconds INTEGER;

-- Anuncios: plantilla de diseño, color de acento y segundos propios.
ALTER TABLE announcements ADD COLUMN template TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE announcements ADD COLUMN accent TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE announcements ADD COLUMN seconds INTEGER;
