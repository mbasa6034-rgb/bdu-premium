PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  university TEXT NOT NULL DEFAULT 'Bahir Dar University',
  campus TEXT,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS device_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id_hash TEXT NOT NULL,
  device_model TEXT,
  platform TEXT DEFAULT 'android',
  app_version TEXT,
  attestation_status TEXT DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','pending')),
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_active_user 
  ON device_registrations(user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_device_hash ON device_registrations(installation_id_hash);

CREATE TABLE IF NOT EXISTS device_change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  old_device_id INTEGER REFERENCES device_registrations(id),
  new_installation_id_hash TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by INTEGER
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  phone TEXT,
  installation_id_hash TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id INTEGER NOT NULL REFERENCES device_registrations(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  stream_id INTEGER,
  semester_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  is_free INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  published INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  receipt_blob BLOB,
  receipt_mime TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  admin_note TEXT,
  reviewed_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS premium_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'none' CHECK(status IN ('none','active','expired')),
  granted_at TEXT,
  expires_at TEXT,
  payment_id INTEGER REFERENCES payments(id)
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

INSERT OR IGNORE INTO programs (name, slug) VALUES 
  ('Freshman', 'freshman'),
  ('Pre-Engineering', 'pre-engineering'),
  ('Pre-Engineering & Technology', 'pre-eng-tech');

INSERT OR IGNORE INTO streams (program_id, name, slug) VALUES
  (1, 'Natural Science', 'natural'),
  (1, 'Social Science', 'social');

INSERT OR IGNORE INTO semesters (name, slug) VALUES
  ('First Semester', 'first'),
  ('Second Semester', 'second');

INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('app_version', '1.0.0'),
  ('welcome_message', 'Welcome to BDU PREMIUM'),
  ('payment_instructions', 'Send payment via Telebirr / CBE Birr and upload receipt.'),
  ('primary_color', '#1a365d');
