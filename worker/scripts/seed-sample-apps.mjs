#!/usr/bin/env node
// Seeds two sample applications through the real API (not a direct DB insert like
// seed-admin.mjs) — token encryption needs the Worker's Secrets Store binding, which only
// exists inside the running Worker, so this has to go through POST /api/applications.
//
// Usage: node scripts/seed-sample-apps.mjs [baseUrl] [adminUser] [adminPassword]
//   defaults:  http://localhost:8787   admin   admin
//
// Values are fake/unreachable on purpose — this seeds the CRUD + encryption path, not a
// working connection to a real target database.

const [baseUrl = "http://localhost:8787", username = "admin", password = "admin"] = process.argv.slice(2);

const SAMPLE_APPS = [
  {
    name: "Marketing Site",
    account_id: "acct-marketing",
    database_id: "db-marketing",
    api_token: "sample-token-marketing",
    table_name: "users",
    field_schema: [
      { key: "id", label: "ID", type: "number" },
      { key: "email", label: "Email", type: "text" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    name: "Support Portal",
    account_id: "acct-support",
    database_id: "db-support",
    api_token: "sample-token-support",
    table_name: "agents",
    field_schema: [
      { key: "id", label: "ID", type: "number" },
      { key: "name", label: "Name", type: "text" },
      { key: "status", label: "Status", type: "boolean" },
    ],
  },
];

async function main() {
  const loginRes = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!loginRes.ok) {
    console.error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
    process.exit(1);
  }
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    console.error("Login succeeded but no session cookie was returned.");
    process.exit(1);
  }

  for (const app of SAMPLE_APPS) {
    const res = await fetch(`${baseUrl}/api/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(app),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error(`Failed to create "${app.name}" (${res.status}):`, body);
      continue;
    }
    console.log(`Created "${app.name}" -> id ${body.id}`);
  }
}

main();
