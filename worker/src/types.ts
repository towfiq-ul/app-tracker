export type FieldType = "text" | "number" | "boolean" | "date" | "datetime";

export interface FieldSchemaEntry {
  key: string;
  label: string;
  type: FieldType;
  editable?: boolean;
  // At most one field carries this; if any field is editable, exactly one must — it's
  // the WHERE-clause column for the UPDATE sent to the target D1 database.
  primaryKey?: boolean;
}

export interface ApplicationRow {
  id: number;
  name: string;
  account_id: string;
  database_id: string;
  api_token_ciphertext: string;
  api_token_iv: string;
  field_schema: string; // JSON-encoded FieldSchemaEntry[]
  table_name: string;
  owner_admin_id: number;
  created_at: string;
}

export interface ApplicationSummary {
  id: number;
  name: string;
  owner_admin_id: number;
  owner_username?: string | null; // only populated on the super_admin list view
  created_at: string;
}

export type AdminRole = "super_admin" | "admin";

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  role: AdminRole;
  name: string;
  email: string | null;
  contact_no: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  admin_id: number;
  expires_at: string;
}

export type Bindings = {
  AUTH_DB: D1Database; // admins, sessions, login_attempts — see schema-auth.sql
  APPS_DB: D1Database; // applications — see schema-apps.sql
  MASTER_KEY: { get(): Promise<string> };
  ALLOWED_ORIGIN: string;
};

export type Variables = {
  adminId: number;
  adminRole: AdminRole;
};
