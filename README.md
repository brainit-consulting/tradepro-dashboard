Learn more at https://brainitconsulting.com/trade-pros-1

## Playwright tests

- Target file defaults to `index.html`; override with `TPB_DASHBOARD_FILE=tradepro_dashboard_v052.html` (or another build) when running.
- Install deps once: `npm install` (Playwright + Chromium are already installed in this workspace).
- Run the suite: `npm test` or `npx playwright test`. Tests seed localStorage and unlock the gate with the `tradepro` passcode automatically.
- View reports: `npx playwright show-report` or open the Playwright Test UI via the VS Code extension/Testing panel.

## Linting

- Install deps once: `npm install`.
- Run the linter: `npm run lint` (targets `index.html` and lints the embedded script via `eslint-plugin-html`).
