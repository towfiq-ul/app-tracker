// App-level brute-force protection for /api/login. Cloudflare's dashboard rate-limiting
// rules are the primary defense in production, but those need a live account to configure
// (see FEASIBILITY_STUDY.md) — this is the fallback that works regardless.

const WINDOW_MINUTES = 15;
const MAX_FAILURES_IN_WINDOW = 5;
const RETENTION_HOURS = 24;

// SQLite's `datetime('now')` (used for created_at's default) writes "YYYY-MM-DD HH:MM:SS" —
// space-separated, no millis, no "Z". Comparing that against a raw toISOString() ("...THH:MM:SS.sssZ")
// is a string comparison where a space sorts before "T", so it silently breaks. Match the format.
function toSqliteDatetime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function isRateLimited(db: D1Database, username: string, ip: string): Promise<boolean> {
  const windowStart = toSqliteDatetime(new Date(Date.now() - WINDOW_MINUTES * 60 * 1000));
  const row = await db
    .prepare(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE success = 0 AND created_at > ? AND (username = ? OR ip = ?)`
    )
    .bind(windowStart, username, ip)
    .first<{ count: number }>();
  return (row?.count ?? 0) >= MAX_FAILURES_IN_WINDOW;
}

export async function recordLoginAttempt(
  db: D1Database,
  username: string,
  ip: string,
  success: boolean
): Promise<void> {
  await db
    .prepare("INSERT INTO login_attempts (username, ip, success) VALUES (?, ?, ?)")
    .bind(username, ip, success ? 1 : 0)
    .run();
}

export async function pruneOldLoginAttempts(db: D1Database): Promise<void> {
  const cutoff = toSqliteDatetime(new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000));
  await db.prepare("DELETE FROM login_attempts WHERE created_at < ?").bind(cutoff).run();
}
