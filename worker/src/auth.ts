import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AdminRole, Bindings, SessionRow, Variables } from "./types";

const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Cloudflare Workers' WebCrypto caps PBKDF2 at 100,000 iterations (deriveBits throws
// NotSupportedError above that) — this is the platform ceiling, not a chosen value.
const PBKDF2_ITERATIONS = 100_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [iterationsRaw, saltB64, hashB64] = stored.split(":");
  if (!iterationsRaw || !saltB64 || !hashB64) return false;
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: Number(iterationsRaw), hash: "SHA-256" },
    keyMaterial,
    256
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function createSession(
  db: D1Database,
  adminId: number
): Promise<{ id: string; expiresAt: string }> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db
    .prepare("INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, adminId, expiresAt)
    .run();
  return { id, expiresAt };
}

export function setSessionCookie(c: Context, sessionId: string, expiresAt: string): void {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession(c: Context, db: D1Database): Promise<void> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function sessionMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return c.json({ error: "Not authenticated" }, 401);

  // Inner join means a deleted admin account invalidates its sessions implicitly — no
  // separate cleanup needed when an account is removed (see routes/admins.ts).
  const session = await c.env.AUTH_DB.prepare(
    `SELECT sessions.id, sessions.admin_id, sessions.expires_at, admins.role
     FROM sessions JOIN admins ON admins.id = sessions.admin_id
     WHERE sessions.id = ?`
  )
    .bind(sessionId)
    .first<SessionRow & { role: AdminRole }>();

  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("adminId", session.admin_id);
  c.set("adminRole", session.role);
  await next();
}

export async function requireSuperAdmin(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  if (c.get("adminRole") !== "super_admin") {
    return c.json({ error: "Super admin access required" }, 403);
  }
  await next();
}
