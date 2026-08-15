export type FieldType = "text" | "number" | "boolean" | "date" | "datetime";

export interface FieldSchemaEntry {
  key: string;
  label: string;
  type: FieldType;
  editable?: boolean;
  // At most one field carries this; required (on exactly one field) if any field is editable.
  primaryKey?: boolean;
}

export interface ApplicationSummary {
  id: number;
  name: string;
  owner_admin_id: number;
  owner_username?: string | null; // only populated for a super_admin
  created_at: string;
}

export interface ApplicationDetail {
  id: number;
  name: string;
  account_id: string;
  database_id: string;
  field_schema: FieldSchemaEntry[];
  table_name: string;
  owner_admin_id: number;
  created_at: string;
}

export interface UserListResponse {
  fields: FieldSchemaEntry[];
  rows: Record<string, unknown>[];
}

export type AdminRole = "super_admin" | "admin";

// Same shape whether it's "my own profile" (GET /api/me) or a row in the super_admin's
// account list (GET /api/admins) — one type covers both.
export interface Admin {
  id: number;
  username: string;
  role: AdminRole;
  name: string;
  email: string | null;
  contact_no: string | null;
  created_at: string;
}
