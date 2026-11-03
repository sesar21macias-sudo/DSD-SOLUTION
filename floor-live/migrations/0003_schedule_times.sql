-- Programación con fecha Y hora para anuncios y fotos.
-- Se guarda la hora local de la planta (El Paso) como "YYYY-MM-DDTHH:MM": así se
-- compara como texto contra "ahora" en la misma zona, sin líos de UTC ni horario de verano.
-- NULL = sin límite (sale de inmediato / nunca se quita sola).
ALTER TABLE announcements ADD COLUMN starts_at TEXT;
ALTER TABLE announcements ADD COLUMN ends_at TEXT;
ALTER TABLE media ADD COLUMN starts_at TEXT;
ALTER TABLE media ADD COLUMN ends_at TEXT;

-- Los anuncios que ya tenían días pasan a horas: desde las 00:00 hasta las 23:59.
UPDATE announcements SET starts_at = starts_on || 'T00:00' WHERE starts_on IS NOT NULL;
UPDATE announcements SET ends_at = ends_on || 'T23:59' WHERE ends_on IS NOT NULL;

CREATE INDEX announcements_window ON announcements(starts_at, ends_at);
CREATE INDEX media_window ON media(starts_at, ends_at);
