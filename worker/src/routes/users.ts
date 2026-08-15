import { Hono } from "hono";
import type { Bindings, Variables, ApplicationRow, FieldSchemaEntry } from "../types";
import { decryptToken } from "../crypto";
import { queryRemoteD1 } from "../d1-remote";
import { isSafeIdentifier } from "../validation";

export const userListRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// A plain admin only ever reaches applications they own; a super_admin reaches all of them.
function isForbidden(c: { get(key: "adminId"): number; get(key: "adminRole"): string }, ownerAdminId: number): boolean {
  return c.get("adminRole") !== "super_admin" && ownerAdminId !== c.get("adminId");
}

userListRoutes.get("/:id/users", async (c) => {
  const id = Number(c.req.param("id"));
  const app = await c.env.APPS_DB.prepare("SELECT * FROM applications WHERE id = ?")
    .bind(id)
    .first<ApplicationRow>();
  if (!app || isForbidden(c, app.owner_admin_id)) return c.json({ error: "Not found" }, 404);

  const fields = JSON.parse(app.field_schema) as FieldSchemaEntry[];

  // Re-validate at read time too, not just on write in routes/applications.ts — cheap
  // insurance against these ever getting into the table some other way.
  if (!isSafeIdentifier(app.table_name) || !fields.every((f) => isSafeIdentifier(f.key))) {
    return c.json({ error: `${app.name} has an invalid table name or field key` }, 500);
  }

  const columns = fields.map((f) => f.key).join(", ");
  const query = `SELECT ${columns} FROM ${app.table_name}`;

  const masterKey = await c.env.MASTER_KEY.get();
  const apiToken = await decryptToken(masterKey, app.api_token_ciphertext, app.api_token_iv);

  let rows: Record<string, unknown>[];
  try {
    rows = await queryRemoteD1(app.account_id, app.database_id, apiToken, query);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to fetch users from ${app.name}: ${message}` }, 502);
  }

  // Only pass through columns declared in the field schema — never leak whatever
  // else the configured query happens to return.
  const shaped = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const field of fields) out[field.key] = row[field.key] ?? null;
    return out;
  });

  return c.json({ fields, rows: shaped });
});

interface UpdateFieldBody {
  field?: string;
  value?: unknown;
  primaryKeyValue?: unknown;
}

userListRoutes.patch("/:id/users", async (c) => {
  const id = Number(c.req.param("id"));
  const app = await c.env.APPS_DB.prepare("SELECT * FROM applications WHERE id = ?")
    .bind(id)
    .first<ApplicationRow>();
  if (!app || isForbidden(c, app.owner_admin_id)) return c.json({ error: "Not found" }, 404);

  const fields = JSON.parse(app.field_schema) as FieldSchemaEntry[];
  const primaryKeyField = fields.find((f) => f.primaryKey);
  if (!primaryKeyField) {
    return c.json({ error: `${app.name} has no primary key column configured` }, 400);
  }

  const body = await c.req.json<UpdateFieldBody>().catch(() => ({}) as UpdateFieldBody);
  const { field: fieldKey, value, primaryKeyValue } = body;

  const field = fields.find((f) => f.key === fieldKey);
  if (!field || !field.editable) {
    return c.json({ error: `${fieldKey} is not an editable field` }, 400);
  }
  if (primaryKeyValue === undefined || primaryKeyValue === null) {
    return c.json({ error: "primaryKeyValue is required" }, 400);
  }

  // Belt-and-braces re-check — these are only ever written by routes/applications.ts's
  // own validateFieldSchema, but a table/column name still ends up interpolated into SQL
  // below since the D1 REST API can only parameterize values, not identifiers.
  if (!isSafeIdentifier(app.table_name) || !isSafeIdentifier(field.key) || !isSafeIdentifier(primaryKeyField.key)) {
    return c.json({ error: `${app.name} has an invalid table name or field key` }, 500);
  }

  const coercedValue = field.type === "boolean" ? (value ? 1 : 0) : value;
  const query = `UPDATE ${app.table_name} SET ${field.key} = ? WHERE ${primaryKeyField.key} = ?`;

  const masterKey = await c.env.MASTER_KEY.get();
  const apiToken = await decryptToken(masterKey, app.api_token_ciphertext, app.api_token_iv);

  try {
    await queryRemoteD1(app.account_id, app.database_id, apiToken, query, [coercedValue, primaryKeyValue]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to update ${app.name}: ${message}` }, 502);
  }

  return c.json({ ok: true, value: coercedValue });
});
