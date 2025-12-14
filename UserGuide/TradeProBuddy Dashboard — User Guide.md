# TradeProBuddy Dashboard — User Guide

## Overview
A single-file dashboard (`index.html`) for tracking project status. Data is stored locally in the browser (it saves automatically in your browser), but the dashboard can also read from or push changes to a shared `status.json` (for example, hosted on GitHub Pages). Optionally, changes can be committed via an `n8n` webhook.

## Quick Start
- **Open the dashboard:** Double-click `index.html` or open it in your browser.
- **Unlock:** Enter the passcode (default: `tradepro`) when prompted.
- **View status:** Check the project overview and branch progress on the main page.
- **Make edits (if enabled):** Use the UI to update items; changes save automatically in your browser.
- **Use shared updates (optional):** Ask a teammate to configure the shared `status.json` or an `n8n` integration to sync updates across devices.

## What’s in the repo
- `index.html` — the dashboard, including UI, logic, passcode gate, and modals.
- `status.json` — the current shared status snapshot.
- `status001.json` — a sample or earlier snapshot.
- Historical HTML files: `dashboardv1.0.1.html`, `indexVersion00*.html`.
- `README.md` — a short project reference.

## Access & security
- The dashboard uses a simple front-end passcode gate. The default passcode is `tradepro` (see `index.html`, the `PASSCODE` constant). Change this passcode before sharing the app publicly. This gate is only a convenience; it does not replace real authentication.
- The passcode gate unlock state is remembered per-device using the `localStorage` key `tpb_gate_ok_v1`.

## Data model (`status.json`)
The status snapshot follows this structure:

```json
{
  "updatedAt": "ISO_TIMESTAMP",
  "overall": {
    "badge": "In Progress",
    "headline": "Short headline",
    "notes": "Longer notes",
    "summary": "Optional summary pill"
  },
  "branches": {
    "n8n": { "status": "In Progress", "progress": 0, "checkpoints": ["..."] },
    "forms": { "status": "", "progress": 0, "checkpoints": [] },
    "reports": { "status": "", "progress": 0, "checkpoints": [] },
    "website": { "status": "", "progress": 0, "checkpoints": [] },
    "architecture": { "status": "", "progress": 0, "checkpoints": [] }
  }
}
```

- `updatedAt`: ISO 8601 timestamp when the snapshot was last changed.
- `overall`: top-level summary for the project.
- `branches`: per-area status. `progress` is a number from `0` to `100`.

## Using the dashboard
- Open `index.html` in a browser.
- Unlock with the passcode (if enabled).
- The UI reads `localStorage` by default. To use a shared `status.json`, configure the app to fetch/push to that file or hook into an `n8n` workflow.

## Notes and tips
- The passcode is client-side only: host the dashboard behind proper authentication when sharing.
- Keep backups of `status.json` and historical snapshots.
- For automation, `n8n` or similar can update `status.json` and commit changes on your behalf.

---

If you want, I can also add a short `README.md` link to the guide or include a small `CONTRIBUTING.md` with instructions for updating `status.json`. Let me know which you'd prefer.