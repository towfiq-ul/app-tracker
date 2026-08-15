-- Application configs — a separate D1 database from schema-auth.sql on purpose, so a
-- leak or bug on one side never exposes the other. Bound as APPS_DB in wrangler.jsonc.
--
-- IF NOT EXISTS everywhere: safe to re-run whenever this file gains a new table.

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  api_token_ciphertext TEXT NOT NULL,
  api_token_iv TEXT NOT NULL,
  field_schema TEXT NOT NULL,
  table_name TEXT NOT NULL,
  -- Soft reference to admins.id in the *other* database (AUTH_DB) — no real cross-database
  -- FK in SQLite/D1, enforced in application code instead. A super_admin can see/manage
  -- every application; a plain admin only the ones they own (see routes/applications.ts).
  owner_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_owner ON applications(owner_admin_id);
