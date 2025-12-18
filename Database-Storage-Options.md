# Database / Storage Options (Future)

High-level options to replace or supplement n8n persistence. No secrets included.

## Supabase (Postgres + Auth)
- URL: https://supabase.com
- Plan: Use a `status` table with `status_json`, `revision`, `updated_at`, `updated_by`, `status_id=main`. Enable RLS or proxy with service role key. Expose GET/POST to match `{ status, revision, updated_at, updated_by }`. See `supabase-migration-plan.md`.

## Neon (Serverless Postgres)
- URL: https://neon.tech
- Plan: Create a single-table schema (same fields as Supabase). Add a tiny proxy (serverless) to handle GET/POST, CORS, and secrets. Keep the dashboard payload identical.

## Planetscale (Serverless MySQL)
- URL: https://planetscale.com
- Plan: Single table with JSON/text for `status_json` plus `revision/updated_at/updated_by`. Use a minimal proxy to expose GET/POST with the existing payload shape. No direct browser access; keep keys in the proxy.

## Cloudflare D1 (Serverless SQLite)
- URL: https://developers.cloudflare.com/d1
- Plan: One-row table for `status_json`, `revision`, `updated_at`, `updated_by`. Use a Cloudflare Worker as a proxy for GET/POST and CORS. Good for light traffic and single-origin use.

## Airtable
- URL: https://airtable.com
- Plan: Single table with fields `status_json`, `revision`, `updated_at`, `updated_by`, `status_id=main`. Use a tiny proxy to avoid exposing the PAT. Keep the existing payload shape. See `airtable-migration-plan.md`.

## Upstash Redis / Vercel KV
- URLs: https://upstash.com / https://vercel.com/docs/storage/vercel-kv
- Plan: Store a single JSON blob + `revision/updated_at/updated_by` keys. Add a small proxy to enforce CORS and handle GET/POST. Simple, but no relational queries.

## PocketBase (Self-hosted, SQLite)
- URL: https://pocketbase.io
- Plan: Run the single-binary server (small VM/container). Create a collection for `status` with JSON and metadata fields. Expose REST via PocketBase, or front it with a tiny proxy for CORS and auth headers.

## Baserow / NocoDB (Self-hosted Airtable-like)
- URLs: https://baserow.io / https://nocodb.com
- Plan: Self-host and define a table mirroring `status_json` + metadata. Use their REST API, or add a light proxy for CORS/auth consistency.

## Appwrite (Self-hosted or Cloud)
- URL: https://appwrite.io
- Plan: Create a collection for `status` with JSON + metadata fields. Use Appwrite’s REST/SDK with appropriate permissions, or a small proxy to simplify headers and CORS.
