# Base44 Migration Prompt for TradeProBuddy Project Dashboard (Build V044 Reference)

Use this brief to recreate the current dashboard in Base44. Keep the payload shapes and UX the same as Build V044. No secrets are included; server settings stay local-only.

## What to Build
- A single-page dashboard with:
  - Passcode gate (`tradepro`) before showing the app.
  - Header: title, build label (V044), owner pill, updated timestamp, server save pill (state/rev), brand logo, overall badge.
  - Toolbar: Edit Overall, Edit a Branch, New Branch, Server Settings, Save To Server, Refresh from Server, Backups dropdown (Dashboard backup/Restore).
  - Overall Status card: headline, notes, badge, optional summary pill, computed overall progress (avg of branches).
  - Progress by Branch card: filters (search/status/priority/owner/tag), progress snapshot mini-chart, branch list with reorder (buttons + drag), meta line (owner/priority/due/tags), checkpoints, status badge with Overdue/At Risk indicators.
  - Modals: Edit Overall, Edit Branch, New Branch, Server Settings (Save/Refresh URLs + API key + updatedBy), Backup/Restore (server settings), Dashboard Backup/Restore (data), loading overlay, toast notifications.
  - Backup/Restore flows:
    - Server settings backup/restore (localStorage only).
    - Dashboard backup/restore (status + branch meta, excludes server settings) with Save As fallback and copy modal; restore requires confirmation modal with summary.
  - Autosave to server when dirty (throttled), remote rev check to avoid overwrites.

## Data Model
- Client state (local):
  - `STATE`: `{ overall: { badge, headline, notes, summary }, branches: { [key]: { status, priority, progress, checkpoints[] } }, branchOrder[], updatedAt }`
  - `META`: `{ meta: { [key]: { owner, tags[], dueDate, priority } } }`
  - Server settings (localStorage only): `{ saveUrl, readUrl, apiKey, updatedBy }`
- Derived:
  - Overall progress = avg(branch.progress).
  - Risk flags: Overdue if dueDate < today; At Risk if due in 7 days or less AND progress < 50%.
  - Save pill shows server rev/state/label.

## API Shape (match current)
- Read (GET): returns `{ status, revision?, updated_at?, updated_by? }` or `{ status: { ... }, ...meta }`
- Save (POST): body `{ updated_by, status }`; response may echo status or just meta; revision increments server-side.
- Extract revision from `revision` or `rev` at various nesting levels.

## UX/Behavior Notes
- Passcode gate persists in localStorage (`tpb_gate_ok_v1`).
- Server settings persist locally; never overwritten by backup/restore of dashboard data.
- Import/export:
  - Server settings: must have saveUrl/readUrl/apiKey to export; import loads into modal, requires explicit Save to persist.
  - Dashboard: exports STATE + META with version/exportedAt; restore validates status/meta, shows confirmation modal before applying, marks dirty afterward.
- Reordering branches works via drag and up/down buttons; respects filtered view.
- Filters update list + progress snapshot; owner/tag options auto-build from META.
- Toasters used for success/warn/error.
- Loading overlay for initial refresh if readUrl present.
- Autosave: if DIRTY and server settings present, throttle and save; remote rev check before manual save to avoid overwrite.

## UI Tone
- Dark, glassy cards, pills, badges; keep compact spacing and pill styles; brand logo in header.
- Keep Backups dropdown in toolbar with down arrow label.

## Build Reference
- Base on Build V044 assets/behavior. Keep revision-aware save/refresh and all backup/restore UX intact.

## Deliverables from Base44
- A Base44 project that reproduces the dashboard with the above features and data shapes.
- Clear instructions for wiring GET/POST endpoints (placeholders for saveUrl/readUrl) and where to set the passcode.
- Confirmation that client-local storage behavior (server settings, gate) is preserved, and server secrets are never embedded.
