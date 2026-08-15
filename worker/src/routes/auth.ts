import { Hono } from "hono";
import type { Bindings, Variables, AdminRow } from "../types";
import { createSession, destroySession, setSessionCookie, verifyPassword } from "../auth";
import { isRateLimited, recordLoginAttempt, pruneOldLoginAttempts } from "../rate-limit";

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

authRoutes.post("/login", async (c) => {
  type LoginBody = { username?: string; password?: string };
  const body = await c.req.json<LoginBody>().catch(() => ({}) as LoginBody);
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: "Username and password are required" }, 400);
  }

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";

  if (await isRateLimited(c.env.AUTH_DB, username, ip)) {
    return c.json({ error: "Too many attempts. Try again in a few minutes." }, 429);
  }

  const admin = await c.env.AUTH_DB.prepare(
    "SELECT id, username, password_hash, created_at FROM admins WHERE username = ?"
  )
    .bind(username)
    .first<AdminRow>();

  // Constant-shape response whether or not the username exists, to avoid leaking
  // which usernames are registered.
  const valid = admin ? await verifyPassword(password, admin.password_hash) : false;

  await recordLoginAttempt(c.env.AUTH_DB, username, ip, valid);
  c.executionCtx.waitUntil(pruneOldLoginAttempts(c.env.AUTH_DB));

  if (!admin || !valid) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const { id: sessionId, expiresAt } = await createSession(c.env.AUTH_DB, admin.id);
  setSessionCookie(c, sessionId, expiresAt);

  return c.json({ id: admin.id, username: admin.username });
});

authRoutes.post("/logout", async (c) => {
  await destroySession(c, c.env.AUTH_DB);
  return c.json({ ok: true });
});
