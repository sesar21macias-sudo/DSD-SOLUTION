-- Floor Live: pantallas de planta (TV) con métricas, anuncios y fotos.
-- Los números vienen del Excel semanal de trabajos cerrados ("Job Data");
-- todo lo demás (anuncios, fotos, pantallas) lo captura la planta.

CREATE TABLE app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Equipo de producción. `code` es la columna Team del Excel (ELP01, EPFJS…);
-- `name` es lo que se lee en la tele ("Team 1", "Binding").
CREATE TABLE teams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  leader     TEXT    NOT NULL DEFAULT '',
  active     INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- admin: toda la planta. leader: solo su equipo (ver su pantalla, publicar avisos y fotos del equipo).
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'leader' CHECK (role IN ('admin', 'leader')),
  team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  password_hash TEXT    NOT NULL,
  password_salt TEXT    NOT NULL,
  iterations    INTEGER NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Intentos fallidos de entrada, para frenar adivinanzas de contraseña.
CREATE TABLE auth_failures (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX auth_failures_key ON auth_failures(key, created_at);

CREATE TABLE imports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  filename     TEXT    NOT NULL,
  year         INTEGER NOT NULL,
  rows_in      INTEGER NOT NULL,
  rows_new     INTEGER NOT NULL,
  rows_updated INTEGER NOT NULL,
  first_week   INTEGER,
  last_week    INTEGER,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Un renglón por trabajo cerrado. Volver a subir el mismo Excel actualiza, no duplica.
CREATE TABLE jobs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  year           INTEGER NOT NULL,
  week           INTEGER NOT NULL,
  job            TEXT    NOT NULL,
  team_code      TEXT    NOT NULL,
  part           TEXT    NOT NULL DEFAULT '',
  units          INTEGER NOT NULL DEFAULT 0,
  inspected      INTEGER NOT NULL DEFAULT 0,
  rejected       INTEGER NOT NULL DEFAULT 0,
  passed         INTEGER NOT NULL DEFAULT 0,
  est_hours      REAL    NOT NULL DEFAULT 0,
  act_hours      REAL    NOT NULL DEFAULT 0,
  rework_hours   REAL    NOT NULL DEFAULT 0,
  d_majors       INTEGER NOT NULL DEFAULT 0,
  d_stitching    INTEGER NOT NULL DEFAULT 0,
  d_seams        INTEGER NOT NULL DEFAULT 0,
  d_binding      INTEGER NOT NULL DEFAULT 0,
  d_webbing      INTEGER NOT NULL DEFAULT 0,
  d_labeling     INTEGER NOT NULL DEFAULT 0,
  d_hardware     INTEGER NOT NULL DEFAULT 0,
  d_construction INTEGER NOT NULL DEFAULT 0,
  d_fabric       INTEGER NOT NULL DEFAULT 0,
  closed_on      TEXT,
  import_id      INTEGER REFERENCES imports(id) ON DELETE SET NULL,
  UNIQUE (year, job)
);
CREATE INDEX jobs_week ON jobs(year, week, team_code);
CREATE INDEX jobs_closed ON jobs(closed_on);

-- Fotos (R2). team_id NULL = de toda la planta.
CREATE TABLE media (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id      INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  r2_key       TEXT    NOT NULL UNIQUE,
  content_type TEXT    NOT NULL,
  width        INTEGER,
  height       INTEGER,
  caption      TEXT    NOT NULL DEFAULT '',
  in_rotation  INTEGER NOT NULL DEFAULT 1,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX media_team ON media(team_id, created_at);

-- Anuncios. Se escriben en uno o en ambos idiomas; la tele muestra el suyo
-- y, si falta, el otro. team_id NULL = de toda la planta.
CREATE TABLE announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id    INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL DEFAULT 'news' CHECK (kind IN ('news', 'celebration', 'safety', 'reminder')),
  title_en   TEXT    NOT NULL DEFAULT '',
  body_en    TEXT    NOT NULL DEFAULT '',
  title_es   TEXT    NOT NULL DEFAULT '',
  body_es    TEXT    NOT NULL DEFAULT '',
  media_id   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  starts_on  TEXT,
  ends_on    TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX announcements_team ON announcements(team_id, ends_on);

-- Televisiones. Cada una guarda en una cookie un secreto largo; aquí solo
-- vive su SHA-256. Mientras está 'pending' muestra un código de 6 letras
-- que el admin teclea en Pantallas para darla de alta.
CREATE TABLE displays (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  scope         TEXT    NOT NULL DEFAULT 'plant' CHECK (scope IN ('plant', 'team')),
  team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  lang          TEXT    NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'es')),
  slide_seconds INTEGER NOT NULL DEFAULT 15,
  secret_hash   TEXT    NOT NULL UNIQUE,
  pair_code     TEXT    UNIQUE,
  pair_expires  TEXT,
  last_seen     TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Resumen en lenguaje sencillo por semana (Claude o, sin llave, las reglas de lib/summary.ts).
-- scope = 'plant' o el código del equipo.
CREATE TABLE insights (
  scope      TEXT    NOT NULL,
  year       INTEGER NOT NULL,
  week       INTEGER NOT NULL,
  lang       TEXT    NOT NULL,
  text       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (scope, year, week, lang)
);
