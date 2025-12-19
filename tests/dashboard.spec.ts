import { test, expect } from '@playwright/test';
import path from 'path';
import { pathToFileURL } from 'url';

const dashboardFile = process.env.TPB_DASHBOARD_FILE || 'index.html';
const dashboardUrl = pathToFileURL(path.join(__dirname, '..', dashboardFile)).href;

const seedState = {
  overall: {
    badge: 'In Progress',
    headline: 'Dashboard seed data loaded',
    notes: 'Used for Playwright smoke coverage',
    summary: 'Smoke'
  },
  branches: {
    alpha: {
      status: 'In Progress',
      progress: 42,
      checkpoints: [
        { text: 'Scope signed', done: true },
        { text: 'Integration validated', done: false }
      ]
    }
  },
  branchOrder: ['alpha'],
  updatedAt: '2025-12-18T12:00:00.000Z'
};

const seedMeta = {
  meta: {
    alpha: {
      owner: 'Emile',
      tags: ['ops', 'sync'],
      dueDate: '2025-12-31',
      priority: 'High'
    }
  }
};

async function unlockDashboard(page) {
  await page.goto(dashboardUrl);
  await expect(page.locator('#gate')).toBeVisible();
  await page.fill('#gateCode', 'tradepro');
  await page.click('#gateBtn');
  await expect(page.locator('#gate')).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ state, meta }) => {
    localStorage.clear();
    localStorage.setItem('tpb_status_v1', JSON.stringify(state));
    localStorage.setItem('tpb_branch_meta_v1', JSON.stringify(meta));
    localStorage.removeItem('tpb_gate_ok_v1');
  }, { state: seedState, meta: seedMeta });

  await unlockDashboard(page);
});

test('shows seeded overall status and branches after unlock', async ({ page }) => {
  await expect(page.locator('#overallBadge')).toContainText('In Progress');
  await expect(page.locator('#overallHeadline')).toContainText('Dashboard seed data loaded');
  await expect(page.locator('#overallNotes')).toContainText('Used for Playwright smoke coverage');

  const alphaCard = page.locator('.branch-item[data-branch-key="alpha"]');
  await expect(alphaCard).toBeVisible();
  await expect(alphaCard.locator('.status')).toContainText('In Progress');
  await expect(alphaCard.locator('.branch-meta')).toContainText('Owner: Emile');
  await expect(alphaCard.locator('ul.ckpts li')).toHaveCount(2);
});

test('creates a new branch via the modal and renders it in the list', async ({ page }) => {
  await page.getByRole('button', { name: 'New Branch' }).click();
  await expect(page.locator('#ovNewBranch')).toBeVisible();

  await page.fill('#nbKey', 'beta');
  await page.selectOption('#nbStatus', 'Active');
  await page.fill('#nbProgress', '72');
  await page.fill('#nbCheckpoints', 'Checkpoint one\nCheckpoint two');
  await expect(page.locator('#nbKey')).toHaveValue('beta');
  await expect(page.locator('#nbProgress')).toHaveValue('72');
  await page.getByRole('button', { name: 'Create Branch' }).click();

  const betaCard = page.locator('.branch-item[data-branch-key="beta"]');
  await expect(betaCard).toBeVisible();
  await expect(betaCard.locator('.status')).toContainText('Active');
  await expect(betaCard.locator('ul.ckpts li')).toHaveCount(2);
  await expect(betaCard.locator('.bar i')).toHaveAttribute('style', /width:72%/);
});

test('edits an existing branch including checkpoints and metadata', async ({ page }) => {
  const alphaCard = page.locator('.branch-item[data-branch-key="alpha"]');
  await alphaCard.getByRole('button', { name: 'Edit' }).click();
  const branchModal = page.locator('#ovBranch');
  await expect(branchModal).toBeVisible();

  await page.fill('#bRename', 'alpha-new');
  await page.selectOption('#bStatus', 'Blocked');
  await page.selectOption('#bPriority', 'Critical');
  await page.fill('#bOwner', 'Ops Team');
  await page.fill('#bTags', 'risk, ops');
  await page.fill('#bDueDate', '2026-01-31');
  await page.fill('#bProgress', '30');

  await page.click('#bCkptToggle'); // collapse
  await page.click('#bCkptToggle'); // expand
  await page.fill('#bCkptNew', 'Hardening');
  await page.click('#bCkptAdd');

  await page.$eval('#saveBranch', (btn) => {
    (btn as HTMLButtonElement).click();
  });
  await expect(branchModal).toBeHidden();

  const renamedCard = page.locator('.branch-item[data-branch-key="alpha-new"]');
  await expect(renamedCard).toBeVisible();
  await expect(renamedCard.locator('.status')).toContainText('Blocked');
  await expect(renamedCard.locator('.branch-meta')).toContainText('Priority: Critical');
  await expect(renamedCard.locator('ul.ckpts li')).toHaveCount(3);
});
