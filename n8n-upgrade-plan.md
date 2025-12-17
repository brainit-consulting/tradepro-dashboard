# n8n Upgrade Plan (Optional)

This plan is **optional** and only needed if you decide to persist branch metadata (owner, tags, due date, priority) in n8n instead of keeping it local-only.

## Current Approach (No n8n Changes)
- Owner/tags/dueDate/priority live in localStorage only.
- Server payload remains unchanged.
- Dashboard renders server status plus local metadata.

## When You Want Server Persistence

### 1) Table Schema Changes
Add columns to the status table (or equivalent):
- `owner` (text)
- `tags` (text, comma-separated)
- `due_date` (date or text)
- `priority` (text)

If you already store JSON in a single column, add a `meta` JSON column instead and store these fields there.

### 2) Read Workflow (n8n)
Include the new fields in the response JSON for each branch.
Example mapping (pseudo):
- `status.branches[key].owner`
- `status.branches[key].tags`
- `status.branches[key].dueDate`
- `status.branches[key].priority`

### 3) Save Workflow (n8n)
Persist the new fields from the incoming payload:
- Read `status.branches[key].owner/tags/dueDate/priority`
- Write to the new columns (or `meta` JSON)

### 4) Backfill (Optional)
If you want older branches to have defaults, set:
- `priority = "Normal"`
- `owner = ""`
- `tags = ""`
- `due_date = null`

## Notes
- This upgrade is **not required** for v033 (local-only fields are fine).
- If you want, share your current Read/Save node outputs and I can draft exact JSON mappings.
