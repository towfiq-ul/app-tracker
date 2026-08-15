import { Hono } from "hono";
import type { Bindings, Variables, AdminRow } from "../types";
import { hashPassword, verifyPassword } from "../auth";
import { isValidEmail, isUniqueConstraintError } from "../validation";

export const meRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PROFILE_COLUMNS = "id, username, role, name, email, contact_no, created_at";

function toProfile(row: Omit<AdminRow, "password_hash">) {
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

meRoutes.get("/", async (c) => {
  const adminId = c.get("adminId");
  const admin = await c.env.AUTH_DB.prepare(`SELECT ${PROFILE_COLUMNS} FROM admins WHERE id = ?`)
    .bind(adminId)
    .first<Omit<AdminRow, "password_hash">>();
  if (!admin) return c.json({ error: "Not found" }, 404);
  return c.json(toProfile(admin));
});

interface ProfileUpdateBody {
  name?: string;
  email?: string;
  contact_no?: string;
}

// Deliberately does not accept username or role — those are super_admin-only
// (see routes/admins.ts), everyone can only ever edit their own name/email/contact here.
meRoutes.put("/", async (c) => {
  const adminId = c.get("adminId");
  const body = await c.req.json<ProfileUpdateBody>().catch(() => ({}) as ProfileUpdateBody);
  const name = body.name?.trim();
  const email = body.email?.trim() || null;
  const contact_no = body.contact_no?.trim() || null;

  if (!name) return c.json({ error: "Name is required" }, 400);
  if (email && !isValidEmail(email)) return c.json({ error: "Invalid email address" }, 400);

  try {
    await c.env.AUTH_DB.prepare("UPDATE admins SET name = ?, email = ?, contact_no = ? WHERE id = ?")
      .bind(name, email, contact_no, adminId)
      .run();
  } catch (err) {
    if (isUniqueConstraintError(err)) return c.json({ error: "That email is already in use" }, 409);
    throw err;
  }

  const admin = await c.env.AUTH_DB.prepare(`SELECT ${PROFILE_COLUMNS} FROM admins WHERE id = ?`)
    .bind(adminId)
    .first<Omit<AdminRow, "password_hash">>();
  return c.json(toProfile(admin!));
});

interface PasswordChangeBody {
  currentPassword?: string;
  newPassword?: string;
}

meRoutes.put("/password", async (c) => {
  const adminId = c.get("adminId");
  const { currentPassword, newPassword } = await c.req.json<PasswordChangeBody>().catch(() => ({}) as PasswordChangeBody);

  if (!currentPassword || !newPassword) {
    return c.json({ error: "Current and new password are required" }, 400);
  }
  if (newPassword.length < 8) {
    return c.json({ error: "New password must be at least 8 characters" }, 400);
  }

  const admin = await c.env.AUTH_DB.prepare("SELECT password_hash FROM admins WHERE id = ?")
    .bind(adminId)
    .first<Pick<AdminRow, "password_hash">>();
  if (!admin) return c.json({ error: "Not found" }, 404);

  const valid = await verifyPassword(currentPassword, admin.password_hash);
  if (!valid) return c.json({ error: "Current password is incorrect" }, 401);

  const password_hash = await hashPassword(newPassword);
  await c.env.AUTH_DB.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").bind(password_hash, adminId).run();
  return c.json({ ok: true });
});
