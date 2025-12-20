# TradePro Dashboard — Developer User Guide

This repository hosts a **static, single-page dashboard** (“TradeProBuddy”) designed to run from GitHub Pages (or any static host). Recent versions (e.g. `tradepro_dashboard_v054.html`) are **self-contained**: all CSS and JS are embedded inside the HTML file.

## Project layout

- `tradepro_dashboard_vNNN.html` — versioned builds (source-of-truth per version).
- `index.html` — the “live” entrypoint for GitHub Pages; **must be overwritten with the latest build** after each new build.
- Older versions (e.g. `tradepro_dashboard_v049.html`) may reference separate assets (`tradepro_dashboard_v049.css`, `tradepro_dashboard_v049.js`); newer builds do not.

## Versioning workflow (how to create a new build)

1. Copy the latest build to the next version:
   - Example: `tradepro_dashboard_v054.html` → `tradepro_dashboard_v055.html`
2. Update the visible build label in the header (`Build: V055`).
3. Make your changes.
4. **Overwrite `index.html` with the latest `tradepro_dashboard_vNNN.html`.**  
   This repo’s convention is that `index.html` always contains the newest build.
5. Sanity-check in a browser (see checklist below), then commit and push.

Tip: The site link `?v=054` is typically used as a **cache buster**. The dashboard itself doesn’t need query params to work.

## How the app works (high level)

- Pure front-end HTML/CSS/JS; no build step required.
- Uses `localStorage` to persist:
  - Dashboard state (overall + branches)
  - Branch meta
  - Branch collapse state
  - Server settings (Read URL / Save URL / API key / updated-by)
  - Theme preference (light/dark)
- Optional “server-first” sync:
  - If server settings exist, the app can fetch the latest state on load and supports Save/Refresh actions.

## Buttons and UI (what each does)

### Header

- Theme toggle (top-right): switches between dark/light and saves preference to `localStorage`.
- **How this works**: shows/hides a short explanation panel on the main page.

### Main toolbar

- **Edit Overall**: opens the “Overall Status” editor (badge/headline/notes/summary). Saves locally; use “Save To Server” to persist remotely.
- **Edit a Branch**: opens the branch editor for an existing branch. Lets you edit status/progress/meta and manage checkpoints. Saves locally; use “Save To Server” to persist remotely.
- **New Branch**: creates a new branch card from a form (key/status/progress/checkpoints). Saves locally; use “Save To Server” to persist remotely.
- **Server Settings**: opens server configuration (Read URL / Save URL / API key / updated-by).
  - **Import settings**: load a previously exported server settings JSON.
  - **Backup settings**: exports server settings to JSON (download when possible; otherwise shows/copies the JSON).
  - **Test connection**: performs a simple GET to the Read URL using the API key header.
  - **Save settings**: stores server settings in `localStorage`.
- **Save To Server**: sends current dashboard state to the configured Save URL (POST). This is the primary way to persist edits to your server.
- **Refresh from Server**: fetches the latest dashboard state from the configured Read URL (GET) and replaces the current in-memory state.
- **Backups** (dropdown):
  - **Dashboard backup**: exports dashboard data (state/meta) to JSON (server settings excluded).
  - **Restore/import**: imports a dashboard backup JSON and replaces local dashboard data after confirmation.

## Theme (dark/light)

- Theme is driven by `body[data-theme="dark" | "light"]`.
- Dark is the default; the user can toggle and the preference is saved in `localStorage`.
- When adjusting colors, prefer using the existing CSS variables (`--bg`, `--card`, `--ink`, `--muted`, `--line`) so both themes remain consistent.

## Checkpoints editor (common pitfall)

Checkpoint rows are rendered as:

- a checkbox (`.cp-check`)
- a text input (`.cp-text-input`)
- a delete button (`.cp-del`)

Important: there is a global CSS rule `input, textarea, select { width: 100%; ... }`.  
If you add any new checkbox/radio inputs, ensure they don’t inherit `width:100%` and break layout. The checkpoint checkbox is explicitly constrained via `.cp-row .cp-check { width/height: …; flex: 0 0 auto; }`.

If users report “I can’t see what I typed”, it’s usually because the checkbox/input layout is broken or the input text color matches the background in one theme.

## Caution: backup before big changes

This dashboard stores most data in `localStorage`. Users can lose local data if they:

- clear browser storage, use a new browser/device/profile, or run in a locked-down environment
- import/restore a backup over existing data
- refresh from server and overwrite local state with older server data

Recommend users do these backups regularly using the built-in buttons:

- **Server Settings → Backup settings** to export server endpoints + API key config.
- **Backups → Dashboard backup** to export dashboard data (branches/overall/meta).

Those JSON backups are the fastest way to recover after a browser reset or accidental overwrite.

## Deploying (GitHub Pages)

Typical setup:

- Settings → Pages → “Deploy from a branch”
- Branch: `main`
- Folder: `/ (root)`

When you push changes to `main`, Pages rebuilds. For this static site, it’s usually **under a couple of minutes**.

## Browser sanity checklist

Open the latest `index.html` (Pages URL or locally) and verify:

- Passcode gate unlock flow works.
- Theme toggle switches and remains after refresh.
- “Edit Branch” → checkpoints:
  - Checkbox does not stretch
  - Text input is visible while typing
  - Add/delete works
- “Save to Server” / “Refresh from Server” still function (if configured).

## Contributing guidelines

- Keep changes scoped to the requested version and update `index.html` after each new build.
- Avoid introducing external dependencies; the goal is “static + portable”.
- Prefer small, targeted edits; the HTML file is large and easy to accidentally break with broad refactors.
