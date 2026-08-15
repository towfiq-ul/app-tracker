# Application Users Tracker

A small admin portal for browsing the user lists of multiple applications, each backed by
its own Cloudflare D1 database. The frontend is a static React app on GitHub Pages; all
auth, configuration, and data-fetching logic lives behind a Cloudflare Worker API.

## Features

- **Admin login** — username/password auth with hashed passwords (PBKDF2), httpOnly session
  cookies, and login rate-limiting.
- **Role-based accounts** — a `super_admin` can add/remove/edit any admin account and reset
  passwords; a plain `admin` can only edit their own profile (name, email, contact number)
  and password.
- **Per-application ownership** — `super_admin` sees and manages every configured
  application; a plain `admin` only sees the ones they created.
- **Configurable applications** — each application stores its own Cloudflare account ID, D1
  database ID, and an API token (AES-GCM encrypted at rest, key held in Cloudflare Secrets
  Store — never returned by the API).
- **Custom field schema per application** — pick which columns show up in the user list, in
  what order, which type they render as, and which (if any) are inline-editable.

## Architecture

```
GitHub Pages (static React/Vite SPA)
        │  fetch(credentials: "include")
        ▼
Cloudflare Worker (Hono)  ── AUTH_DB (D1): admins, sessions, login_attempts
        │                 └─ APPS_DB (D1): applications (encrypted tokens, field schema)
        │
        ▼  D1 REST API, per-application scoped token
Each application's own Cloudflare D1 database
```

Two separate D1 databases on purpose: a leak or bug on one side (application configs,
which hold encrypted per-app tokens) should never expose the other (admin credentials and
sessions).

## Tech stack

- **Frontend**: React 19, TypeScript, Vite, React Router
- **Backend**: Cloudflare Workers, [Hono](https://hono.dev/)
- **Storage**: Cloudflare D1 (two databases), Cloudflare Secrets Store
- **Hosting**: GitHub Pages (frontend), Cloudflare Workers (API)

## Project structure

```
frontend/    React + Vite SPA, deployed to GitHub Pages
worker/      Cloudflare Worker API (Hono), D1 schema, deploy scripts
```

## Getting started

### Prerequisites

- Node.js 20+
- A Cloudflare account
- [`wrangler`](https://developers.cloudflare.com/workers/wrangler/) (installed as a dev
  dependency of `worker/`, invoked via `npm run` / `npx`)

### Install

```
make install
```

### One-time Cloudflare setup

```
cd worker
npx wrangler login
npx wrangler d1 create users_tracker_auth
npx wrangler d1 create users_tracker_apps
```

Copy the resulting database IDs into `worker/wrangler.jsonc`. Then create the master key
used to encrypt per-application API tokens:

```
npx wrangler secrets-store store create application-users-tracker --remote
npx wrangler secrets-store secret create <store-id> --name app-token-master-key --scopes workers --remote
# paste a random 32-byte base64 value when prompted, e.g.:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put the resulting store ID into `worker/wrangler.jsonc` under `secrets_store_secrets`.

### Apply the schema and seed an admin

```
make db-apply-local      # or db-apply-remote for the real Cloudflare account
make seed-admin ADMIN_USER=admin ADMIN_PASSWORD=<something-strong>
```

The bootstrap admin is created with the `admin` role — promote it to `super_admin` once
seeded, since only a `super_admin` can create further accounts:

```
npx wrangler d1 execute users_tracker_auth --local --command \
  "UPDATE admins SET role = 'super_admin' WHERE username = 'admin'"
```

(Drop `--local` to run it against the real Cloudflare database instead.)

### Run locally

```
make dev
```

This runs the Worker (`wrangler dev`, `http://localhost:8787`) and the frontend (Vite,
`http://localhost:3012`) together. Local Worker CORS is configured via `worker/.dev.vars`
(gitignored):

```
ALLOWED_ORIGIN=http://localhost:3012
```

### Deploy

```
make deploy-worker   # Cloudflare Worker API
make build            # frontend/dist, published to GitHub Pages
```

The frontend deploys to GitHub Pages via `.github/workflows/deploy-pages.yml` on every push
to `master` that touches `frontend/`. Set `ALLOWED_ORIGIN` in `worker/wrangler.jsonc` to the
real GitHub Pages origin before deploying the Worker to production.

## License

Licensed under the [MIT License](LICENSE).
