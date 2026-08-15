import { Hono } from "hono";
import type { Bindings, Variables, AdminRow, AdminRole } from "../types";
import { hashPassword } from "../auth";
import { isValidEmail, isUniqueConstraintError } from "../validation";

// Mounted at /api/admins, gated by requireSuperAdmin in index.ts — every route here manages
// *other* accounts. Self-service profile/password editing lives in routes/me.ts instead.
export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const ROLES: AdminRole[] = ["super_admin", "admin"];
const LIST_COLUMNS = "id, username, role, name, email, contact_no, created_at";

function toSummary(row: Omit<AdminRow, "password_hash">) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    name: row.name,
    email: row.email,
    contact_no: row.contact_no,
    created_at: row.created_at,
  };
}

async function superAdminCount(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'").first<{ count: number }>();
  return row?.count ?? 0;
}

adminRoutes.get("/", async (c) => {
  const { results } = await c.env.AUTH_DB.prepare(`SELECT ${LIST_COLUMNS} FROM admins ORDER BY username`).all<
    Omit<AdminRow, "password_hash">
  >();
  return c.json(results.map(toSummary));
});

interface CreateBody {
  username?: string;
  password?: string;
  role?: string;
  name?: string;
  email?: string;
  contact_no?: string;
}

adminRoutes.post("/", async (c) => {
  const body = await c.req.json<CreateBody>().catch(() => ({}) as CreateBody);
  const username = body.username?.trim();
  const password = body.password;
  const role = body.role?.trim() as AdminRole | undefined;
  const name = body.name?.trim();
  const email = body.email?.trim() || null;
  const contact_no = body.contact_no?.trim() || null;

  if (!username || !password || !role || !name) {
    return c.json({ error: "username, password, role, and name are required" }, 400);
  }
  if (!ROLES.includes(role)) return c.json({ error: "role must be 'super_admin' or 'admin'" }, 400);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);
  if (email && !isValidEmail(email)) return c.json({ error: "Invalid email address" }, 400);

  const password_hash = await hashPassword(password);
  try {
    const result = await c.env.AUTH_DB.prepare(
      "INSERT INTO admins (username, password_hash, role, name, email, contact_no) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(username, password_hash, role, name, email, contact_no)
      .run();
    return c.json({ id: result.meta.last_row_id }, 201);
  } catch (err) {
    if (isUniqueConstraintError(err)) return c.json({ error: "That username or email is already in use" }, 409);
    throw err;
  }
});

interface UpdateBody {
  username?: string;
  role?: string;
  name?: string;
  email?: string;
  contact_no?: string;
}

adminRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const existing = await c.env.AUTH_DB.prepare("SELECT * FROM admins WHERE id = ?").bind(id).first<AdminRow>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json<UpdateBody>().catch(() => ({}) as UpdateBody);
  const username = body.username?.trim();
  const role = (body.role?.trim() as AdminRole | undefined) ?? existing.role;
  const name = body.name?.trim();
  const email = body.email?.trim() || null;
  const contact_no = body.contact_no?.trim() || null;

  if (!username || !name) return c.json({ error: "username and name are required" }, 400);
  if (!ROLES.includes(role)) return c.json({ error: "role must be 'super_admin' or 'admin'" }, 400);
  if (email && !isValidEmail(email)) return c.json({ error: "Invalid email address" }, 400);

  // Guard against locking everyone out by demoting the only super_admin.
  if (existing.role === "super_admin" && role !== "super_admin" && (await superAdminCount(c.env.AUTH_DB)) <= 1) {
    return c.json({ error: "Cannot demote the last super admin" }, 400);
  }

  try {
    await c.env.AUTH_DB.prepare("UPDATE admins SET username = ?, role = ?, name = ?, email = ?, contact_no = ? WHERE id = ?")
      .bind(username, role, name, email, contact_no, id)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) return c.json({ error: "That username or email is already in use" }, 409);
    throw err;
  }
  return c.json({ ok: true });
});

adminRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (id === c.get("adminId")) return c.json({ error: "You cannot remove your own account" }, 400);

  const existing = await c.env.AUTH_DB.prepare("SELECT role FROM admins WHERE id = ?").bind(id).first<Pick<AdminRow, "role">>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (existing.role === "super_admin" && (await superAdminCount(c.env.AUTH_DB)) <= 1) {
    return c.json({ error: "Cannot remove the last super admin" }, 400);
  }

  await c.env.AUTH_DB.prepare("DELETE FROM admins WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

interface PasswordResetBody {
  newPassword?: string;
}

// Super-admin-assisted reset (no current password needed) — the substitute for
// self-service email recovery, which is intentionally out of scope for now.
adminRoutes.put("/:id/password", async (c) => {
  const id = Number(c.req.param("id"));
  const { newPassword } = await c.req.json<PasswordResetBody>().catch(() => ({}) as PasswordResetBody);
  if (!newPassword || newPassword.length < 8) {
    return c.json({ error: "New password must be at least 8 characters" }, 400);
  }

  const existing = await c.env.AUTH_DB.prepare("SELECT id FROM admins WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const password_hash = await hashPassword(newPassword);
  await c.env.AUTH_DB.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").bind(password_hash, id).run();
  return c.json({ ok: true });
});
