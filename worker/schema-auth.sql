-- Auth/admin data — a separate D1 database from schema-apps.sql on purpose, so a
-- leak or bug on one side never exposes the other. Bound as AUTH_DB in wrangler.jsonc.
--
-- IF NOT EXISTS everywhere: safe to re-run whenever this file gains a new table.

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  -- 'super_admin' can manage every admin account and every application; 'admin' can only
  -- edit their own profile/password and only see applications they own (see schema-apps.sql).
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE,
  contact_no TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Login attempt log, used for app-level brute-force protection on /api/login.
-- (Defense in depth alongside, not instead of, Cloudflare's dashboard rate-limiting
-- rules — those need a live account to configure, see FEASIBILITY_STUDY.md.)
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip TEXT NOT NULL,
  success INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, created_at);
