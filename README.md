Learn more at https://brainitconsulting.com/trade-pros-1

## BrainIT Project Dashboard (Single-File)

A clean, single-page project dashboard for tracking branch status, progress, owners, tags, and checkpoints. Works instantly as a standalone HTML file and scales up to a server-backed workflow when you're ready.

## Two ways to use it

1) Local-only (no server)
- Open the HTML file in your browser.
- Your data saves to your browser's localStorage.
- Ideal for solo use, quick planning, or offline work.

2) Server-backed (n8n)
- Connect your Save/Read endpoints + API key in Settings.
- Your data persists to your server and can be shared across devices.
- Best for teams or long-term tracking.
- n8n workflow JSONs are available for Pro Users (Paid Plan) at $10 per license.

## Includes

- Risk badges (overdue / at-risk), progress snapshot, backups, and restore/import.
- Smart filters and a clean, readable UI that works on desktop and mobile.

## Quick start

- Download the latest `brainit_project_dashboard_vNNN.html`.
- Open it to begin (Local mode), or connect your n8n endpoints for Server mode.

## Playwright tests

- Target file defaults to `index.html`; override with `TPB_DASHBOARD_FILE=brainit_project_dashboard_vNNN.html` (or another build) when running.
- Install deps once: `npm install` (Playwright + Chromium are already installed in this workspace).
- Run the suite: `npm test` or `npx playwright test`. Tests seed localStorage and unlock the gate with the `tradepro` passcode automatically.
- View reports: `npx playwright show-report` or open the Playwright Test UI via the VS Code extension/Testing panel.

## Linting

- Install deps once: `npm install`.
- Run the linter: `npm run lint` (targets `index.html` and lints the embedded script via `eslint-plugin-html`).
- Current policy: warnings are acceptable; we use lint as a heads-up check without fixing all warnings immediately.
