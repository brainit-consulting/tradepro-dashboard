# Base44 Storage + Auth Plan (Future Build)

This plan describes how to rebuild the dashboard on Base44 using their standard storage (Supabase-based) and user authentication, while keeping the existing look/feel and core project data model. Remove redundant buttons/features tied to local/server settings; keep the project data workflows.

## Goals
- Use Base44 standard auth (replace the passcode gate).
- Persist project data in Base44 storage (Supabase) instead of localStorage/n8n.
- Preserve current UI style and primary flows (overall status, branches, filters, reorder, progress, risk badges).
- Simplify/removal: server settings modal, server save/refresh buttons, local backup/restore for server settings. Keep project backup/restore if desired (optional).

## Data Model (same as current project data)
- `status` object:
  - `overall`: `{ badge, headline, notes, summary }`
  - `branches`: `{ [key]: { status, priority, progress, checkpoints[] } }`
  - `branchOrder`: string[]
  - `updatedAt`: ISO string
- `meta` (branch metadata):
  - `{ [key]: { owner, tags[], dueDate, priority } }`
- Revision meta:
  - `revision` (number), `updated_at` (ISO), `updated_by` (string)

## Base44 Storage Mapping (Supabase)
- Table: `status`
  - `status_id` (text, PK) — use `main`
  - `status_json` (jsonb) — full `status` object
  - `meta_json` (jsonb) — branch meta
  - `revision` (int)
  - `updated_at` (timestamptz, default `now()`)
  - `updated_by` (text)
- API shape (keep existing dashboard contract):
  - `GET /status` → `{ status, meta, revision, updated_at, updated_by }`
  - `POST /status` → body `{ status, meta, updated_by }`; server sets `updated_at`, increments `revision`; returns meta.
- RLS/permissions: enforce auth; allow only authorized users to read/write `status_id = 'main'` (or per-user/org key if multi-tenant).

## Auth
- Replace the passcode gate with Base44 auth:
  - Use Base44-provided sign-in (Supabase auth) UI or a simple email/OTP flow.
  - Require auth before fetching/writing status.
  - Store session in Base44’s client; refresh tokens handled by Base44/Supabase.

## UI Changes
- Remove: Server Settings modal, Save/Refresh buttons, server save pill, server settings backup/restore.
- Keep: Project data editing (overall, branch), filters, reorder, progress chart, risk badges.
- Optional: Keep dashboard backup/restore (project data only) as a safety net; label it “Local backup.”
- Adjust header pill: show “Synced” with `rev` from Base44, using `revision/updated_at/updated_by`.

## Client Integration (Base44 SDK)
- Initialize a Base44 client per https://docs.base44.com/sdk-docs/functions/createClient using the Base44 URL/anon key (or use service proxy if provided).
- On app load:
  - If not authenticated, show login; else fetch `/status`.
  - Hydrate state from response; set `revision/updated_at/updated_by`.
- Save:
  - On manual save or autosave (throttled), POST `{ status, meta, updated_by }`.
  - On success, update local state with returned `revision/updated_at/updated_by`.
- Conflict guard:
  - Optionally fetch `revision` before save; if remote > local, warn and ask to refresh.

## Migration Steps
1) Create the `status` table/record in Base44 (Supabase) with schema above; seed with latest V044 dashboard data (status + meta + revision).
2) Enable auth and RLS so only your users can read/write `status_id = main`.
3) Point the dashboard’s Read/Save endpoints to the Base44-hosted API (or Supabase RPC) that returns the same shape.
4) Remove server settings UI; hardcode endpoints via config/env in Base44.
5) Test flows: login → fetch → edit → save → refresh; verify revision updates and conflict warning.

## Notes
- Do not embed service keys in the client; use Base44-provided public keys only with proper RLS, or route through a Base44 function/proxy that holds secrets.
- Keep the project backup/restore only for the dashboard data; clarify it is local/manual and not needed when Base44 storage is authoritative.
