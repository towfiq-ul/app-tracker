#!/usr/bin/env node
// One-off: generates a password hash in the same format auth.ts verifies against,
// and prints the SQL to insert it. There is no open signup route on purpose.
//
// Usage: node scripts/seed-admin.mjs <username> <password>

// Must match worker/src/auth.ts — Cloudflare Workers' WebCrypto caps PBKDF2 at 100,000
// iterations, and verifyPassword there runs in that runtime.
const PBKDF2_ITERATIONS = 100_000;

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
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
  return `${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(new Uint8Array(bits))}`;
}

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage: node scripts/seed-admin.mjs <username> <password>");
  process.exit(1);
}

const hash = await hashPassword(password);
const escaped = hash.replace(/'/g, "''");
const usernameEscaped = username.replace(/'/g, "''");

console.log("Run this against the auth D1 database (add --remote for production):\n");
console.log(
  `npx wrangler d1 execute users_tracker_auth --local --command "INSERT INTO admins (username, password_hash) VALUES ('${usernameEscaped}', '${escaped}')"`
);
