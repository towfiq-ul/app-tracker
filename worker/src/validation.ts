// Table/column names get interpolated directly into the SQL sent to a target account's D1
// (see routes/users.ts) — the D1 REST API only parameterizes values, not identifiers. Restrict
// both to a conservative identifier shape so a table name or field key can never smuggle in SQL.
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isSafeIdentifier(value: string): boolean {
  return SAFE_IDENTIFIER.test(value);
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value);
}

// D1 surfaces UNIQUE violations as a generic Error with this substring in the message —
// there's no typed error class to catch instead.
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed");
}
