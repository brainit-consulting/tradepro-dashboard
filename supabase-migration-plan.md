# Supabase Migration Plan (Future)

This outlines how to replace n8n persistence with Supabase while keeping the dashboard payload/UX the same. No secrets included; see https://supabase.com/docs for details.

## Goals
- Persist dashboard state centrally with revision metadata.
- Keep the payload shape: `{ status, revision, updated_at, updated_by }`.
- Avoid exposing service keys in the browser; use Row-Level Security (RLS) correctly.

## Recommended Architecture
- Use a single table in Postgres (via Supabase) plus a minimal API layer.
- Option A (simpler, but requires trusted frontends): expose Supabase REST with RLS policies that only allow your frontends (via anon key + policies).  
- Option B (safer): add a tiny proxy (serverless) using the Supabase service role key; the browser calls the proxy, not Supabase directly.
- Keep CORS locked to your dashboard origin(s).

## Table Schema (`status`)
- `status_id` (text, PK) — set to `main`.
+- `status_json` (jsonb) — the entire dashboard state.
- `revision` (integer).
- `updated_at` (timestamptz).
- `updated_by` (text).
- Optional: `created_at` (timestamptz, default `now()`), `is_active` (bool).

## API Shape (match current dashboard)
- `GET /status`: return `{ status, revision, updated_at, updated_by }`.
- `POST /status`: accept `{ status, updated_by }`; server sets `updated_at = now()`, increments `revision`, returns the saved meta.
- Payload: `status` is the full dashboard object; keep identical to current client.

## RLS & Keys
- Enable RLS on `status`.
- Policies (if using anon key from browser):
  - `SELECT` policy: allow only `status_id = 'main'`.
  - `INSERT/UPDATE` policy: allow only `status_id = 'main'`, and optionally enforce a shared secret header or Supabase Auth role.
- Prefer **service role key** only in a backend/proxy; never expose it in the browser.
- If you must use anon key, add an application-level secret header checked in an RPC or via a proxy to avoid trivial writes.

## Supabase RPC (optional)
- Create a Postgres function `save_status(status_json jsonb, updated_by text)` that:
  - Increments `revision`.
  - Updates `status_json`, `updated_at = now()`, `updated_by`.
  - Returns `{ revision, updated_at, updated_by, status_json }`.
- Expose via Supabase RPC; add RLS policy to allow calling this RPC for `status_id = 'main'`.

## Migration Steps (one-time)
1) Create the `status` table with fields above; insert row `status_id = 'main'`.
2) Export current dashboard state (use Dashboard Backup JSON).
3) Seed the table: set `status_json`, `revision`, `updated_at`, `updated_by`.
4) Add RLS policies (or use a proxy with the service role key).
5) Update dashboard Server Settings to point to the Supabase-backed endpoints; test Read → Save → Read.

## Notes & Limits
- JSONB size: Postgres handles large JSON; current payload is small.
- Rate limits: Supabase enforces per-project limits; dashboard traffic is light.
- Security: keep service role key server-side; use RLS if hitting Supabase directly from the browser.
- Backups: Supabase provides point-in-time recovery on paid tiers; still keep app-level backups for safety.
