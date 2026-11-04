-- Láminas que cada pantalla NO muestra (JSON, p. ej. ["rankings","trend"]); [] = todas.
ALTER TABLE displays ADD COLUMN hidden_slides TEXT NOT NULL DEFAULT '[]';

-- Bitácora de cambios hechos a mano en los trabajos (quién, cuándo, qué).
CREATE TABLE job_edits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  year       INTEGER NOT NULL,
  job        TEXT    NOT NULL,
  action     TEXT    NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  summary    TEXT    NOT NULL DEFAULT '',
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX job_edits_recent ON job_edits(created_at);
