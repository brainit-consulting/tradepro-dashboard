# Airtable Migration Plan (Future)

This is a reference outline for replacing the current n8n persistence with Airtable while keeping the dashboard payload/UX the same. No secrets included.

## Goals
- Persist `status_json` + `revision` + `updated_at` + `updated_by` centrally.
- Keep the dashboard payload shape unchanged (`{ status: {...}, revision, updated_at, updated_by }`).
- Do not expose any Airtable keys in the browser.

## Recommended Architecture
- Add a tiny proxy (serverless is fine) that exposes:
  - `GET /status` → reads Airtable record and returns `{ status, revision, updated_at, updated_by }`.
  - `POST /status` → writes the incoming payload to Airtable, increments revision, stamps `updated_at/updated_by`, and returns the saved meta.
- Proxy holds Airtable PAT/base/table IDs; browser only talks to the proxy.
- CORS: allow your dashboard origin(s) only.

## Airtable Schema (one table, e.g., `status`)
- Primary key: `status_id` (set to `main`).
- Fields:
  - `status_json` (long text / JSON string of the dashboard state).
  - `revision` (number).
  - `updated_at` (datetime).
  - `updated_by` (single line text).
  - Optional: `created_at`, `is_active` (if you want parity with the current table).

## Proxy Behavior
- `GET /status`:
  - Fetch record `status_id = main`.
  - Parse `status_json` into `status`.
  - Return `{ status, revision, updated_at, updated_by }`.
- `POST /status`:
  - Validate `req.body.status` object.
  - Increment `revision` (or accept client revision+1).
  - Set `updated_at = now` (ISO) and `updated_by` from request.
  - Store `status_json` (stringified), `revision`, `updated_at`, `updated_by`.
  - Return `{ status, revision, updated_at, updated_by }`.
- Errors: return HTTP 400 for bad payload, 500 for Airtable issues.

## Dashboard Config Changes
- Update Server Settings to point to the proxy endpoints (Save/Read URLs).
- Keep payload identical so no UI/logic changes are needed.

## Migration Steps (one-time)
1) Create the Airtable base/table with the fields above; add the `status_id = main` record.
2) Export current dashboard state (use Dashboard Backup JSON).
3) Seed Airtable via a simple script/cURL: write `status_json`, set `revision`, `updated_at`, `updated_by`.
4) Deploy the proxy with your Airtable PAT/base/table IDs as environment variables.
5) In the dashboard, set the new Save/Read URLs to the proxy; test Read → Save → Read.

## Notes & Limits
- Airtable cell limit: 100 KB per cell; current payload is typically below that.
- Rate limit: ~5 requests/sec per base; autosave is fine as long as it’s throttled.
- Keep PAT out of the browser; never call Airtable directly from the dashboard.
