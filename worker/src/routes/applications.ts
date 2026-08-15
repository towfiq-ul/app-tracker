import { Hono } from "hono";
import type { Bindings, Variables, ApplicationRow, ApplicationSummary, FieldSchemaEntry } from "../types";
import { encryptToken } from "../crypto";
import { isSafeIdentifier } from "../validation";

export const applicationRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

interface ApplicationInput {
  name?: string;
  account_id?: string;
  database_id?: string;
  api_token?: string; // required on create, optional on update (blank = keep existing)
  field_schema?: FieldSchemaEntry[];
  table_name?: string;
}

// Trims every string field before it's validated or stored — a stray leading/trailing
// space (easy to introduce via copy-paste) would otherwise slip past validation on fields
// like account_id/database_id that aren't identifier-checked, and land in the D1 REST API
// URL as a literal space (e.g. "%20db-123"), producing a confusing routing error far from
// the actual cause.
function sanitizeInput(body: ApplicationInput): ApplicationInput {
  return {
    name: body.name?.trim(),
    account_id: body.account_id?.trim(),
    database_id: body.database_id?.trim(),
    api_token: body.api_token?.trim(),
    table_name: body.table_name?.trim(),
    field_schema: body.field_schema?.map((f) => ({ ...f, key: f.key?.trim(), label: f.label?.trim() })),
  };
}

const FIELD_TYPES = ["text", "number", "boolean", "date", "datetime"];

// The user-list table renders every field as an evenly-split column with no horizontal
// scroll (see UserTable.tsx / index.css) — that only stays legible up to this many columns.
const MAX_FIELDS = 12;

function validateFieldSchema(value: unknown): value is FieldSchemaEntry[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0 || value.length > MAX_FIELDS) return false;
  const shapeOk = value.every(
    (entry) =>
      entry &&
      typeof entry.key === "string" &&
      isSafeIdentifier(entry.key) &&
      typeof entry.label === "string" &&
      entry.label.length > 0 &&
      FIELD_TYPES.includes(entry.type) &&
      (entry.editable === undefined || typeof entry.editable === "boolean") &&
      (entry.primaryKey === undefined || typeof entry.primaryKey === "boolean")
  );
  if (!shapeOk) return false;

  // Editing a row needs a WHERE-clause column, so the moment any field is editable,
  // exactly one field must be marked as the primary key.
  const primaryKeyCount = value.filter((entry) => entry.primaryKey).length;
  if (primaryKeyCount > 1) return false;
  const hasEditable = value.some((entry) => entry.editable);
  if (hasEditable && primaryKeyCount !== 1) return false;

  return true;
}

// Public shape of an application row: never includes the token ciphertext/IV.
function toDetail(row: ApplicationRow) {
  return {
    id: row.id,
    name: row.name,
    account_id: row.account_id,
    database_id: row.database_id,
    field_schema: JSON.parse(row.field_schema) as FieldSchemaEntry[],
    table_name: row.table_name,
    owner_admin_id: row.owner_admin_id,
    created_at: row.created_at,
  };
}

// A plain admin only ever sees applications they own; a super_admin sees (and can act on)
// every application. Returns true when access should be denied.
function isForbidden(c: { get(key: "adminId"): number; get(key: "adminRole"): string }, ownerAdminId: number): boolean {
  return c.get("adminRole") !== "super_admin" && ownerAdminId !== c.get("adminId");
}

applicationRoutes.get("/", async (c) => {
  const adminId = c.get("adminId");
  const isSuperAdmin = c.get("adminRole") === "super_admin";

  const stmt = isSuperAdmin
    ? c.env.APPS_DB.prepare("SELECT id, name, owner_admin_id, created_at FROM applications ORDER BY name")
    : c.env.APPS_DB.prepare("SELECT id, name, owner_admin_id, created_at FROM applications WHERE owner_admin_id = ? ORDER BY name").bind(adminId);
  const { results } = await stmt.all<ApplicationSummary>();

  if (!isSuperAdmin || results.length === 0) return c.json(results);

  // Super admin sees every application — resolve owner usernames from AUTH_DB (a separate
  // database; no cross-database join available) so the list shows who configured each one.
  const ownerIds = [...new Set(results.map((r) => r.owner_admin_id))];
  const placeholders = ownerIds.map(() => "?").join(",");
  const { results: owners } = await c.env.AUTH_DB.prepare(
    `SELECT id, username FROM admins WHERE id IN (${placeholders})`
  )
    .bind(...ownerIds)
    .all<{ id: number; username: string }>();
  const ownerNames = new Map(owners.map((o) => [o.id, o.username]));
  return c.json(results.map((r) => ({ ...r, owner_username: ownerNames.get(r.owner_admin_id) ?? null })));
});

applicationRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.APPS_DB.prepare("SELECT * FROM applications WHERE id = ?")
    .bind(id)
    .first<ApplicationRow>();
  // 404 (not 403) when forbidden too — doesn't reveal that another admin's app exists.
  if (!row || isForbidden(c, row.owner_admin_id)) return c.json({ error: "Not found" }, 404);
  return c.json(toDetail(row));
});

applicationRoutes.post("/", async (c) => {
  const rawBody = await c.req.json<ApplicationInput>().catch(() => ({}) as ApplicationInput);
  const { name, account_id, database_id, api_token, field_schema, table_name } = sanitizeInput(rawBody);

  if (!name || !account_id || !database_id || !api_token || !table_name) {
    return c.json(
      { error: "name, account_id, database_id, api_token, and table_name are required" },
      400
    );
  }
  if (!isSafeIdentifier(table_name)) {
    return c.json({ error: "table_name must look like a plain SQL identifier" }, 400);
  }
  if (!validateFieldSchema(field_schema)) {
    return c.json({ error: "field_schema must be a non-empty array of at most 12 { key, label, type } entries, with at most one primaryKey and exactly one if any field is editable" }, 400);
  }

  const masterKey = await c.env.MASTER_KEY.get();
  const { ciphertext, iv } = await encryptToken(masterKey, api_token);

  // Always the creator, never client-supplied — an app belongs to whoever configured it.
  const ownerAdminId = c.get("adminId");

  const result = await c.env.APPS_DB.prepare(
    `INSERT INTO applications
      (name, account_id, database_id, api_token_ciphertext, api_token_iv, field_schema, table_name, owner_admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(name, account_id, database_id, ciphertext, iv, JSON.stringify(field_schema), table_name, ownerAdminId)
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

applicationRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const existing = await c.env.APPS_DB.prepare("SELECT * FROM applications WHERE id = ?")
    .bind(id)
    .first<ApplicationRow>();
  if (!existing || isForbidden(c, existing.owner_admin_id)) return c.json({ error: "Not found" }, 404);

  const rawBody = await c.req.json<ApplicationInput>().catch(() => ({}) as ApplicationInput);
  const { name, account_id, database_id, api_token, field_schema, table_name } = sanitizeInput(rawBody);

  if (!name || !account_id || !database_id || !table_name) {
    return c.json({ error: "name, account_id, database_id, and table_name are required" }, 400);
  }
  if (!isSafeIdentifier(table_name)) {
    return c.json({ error: "table_name must look like a plain SQL identifier" }, 400);
  }
  if (!validateFieldSchema(field_schema)) {
    return c.json({ error: "field_schema must be a non-empty array of at most 12 { key, label, type } entries, with at most one primaryKey and exactly one if any field is editable" }, 400);
  }

  let ciphertext = existing.api_token_ciphertext;
  let iv = existing.api_token_iv;
  if (api_token) {
    const masterKey = await c.env.MASTER_KEY.get();
    ({ ciphertext, iv } = await encryptToken(masterKey, api_token));
  }

  await c.env.APPS_DB.prepare(
    `UPDATE applications
     SET name = ?, account_id = ?, database_id = ?, api_token_ciphertext = ?, api_token_iv = ?,
         field_schema = ?, table_name = ?
     WHERE id = ?`
  )
    .bind(name, account_id, database_id, ciphertext, iv, JSON.stringify(field_schema), table_name, id)
    .run();

  return c.json({ ok: true });
});

applicationRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const existing = await c.env.APPS_DB.prepare("SELECT owner_admin_id FROM applications WHERE id = ?")
    .bind(id)
    .first<Pick<ApplicationRow, "owner_admin_id">>();
  if (!existing || isForbidden(c, existing.owner_admin_id)) return c.json({ error: "Not found" }, 404);

  await c.env.APPS_DB.prepare("DELETE FROM applications WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
