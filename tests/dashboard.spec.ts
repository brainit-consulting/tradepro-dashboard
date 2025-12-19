import { test, expect } from '@playwright/test';
import path from 'path';
import { pathToFileURL } from 'url';

const dashboardFile = process.env.TPB_DASHBOARD_FILE || 'index.html';
const dashboardUrl = pathToFileURL(path.join(__dirname, '..', dashboardFile)).href;
const REAL_SAVE_URL = process.env.TPB_SAVE_URL || '';
const REAL_READ_URL = process.env.TPB_READ_URL || '';
const REAL_API_KEY = process.env.TPB_API_KEY || '';
const USE_REAL_SERVER = !!(REAL_SAVE_URL && REAL_READ_URL && REAL_API_KEY);
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

test('saves to server and refreshes from server', async ({ page }) => {
  const serverSaveUrl = USE_REAL_SERVER ? REAL_SAVE_URL : 'https://api.local/save';
  const serverReadUrl = USE_REAL_SERVER ? REAL_READ_URL : 'https://api.local/read';
  const remoteStatus = {
    overall: {
      badge: 'On Track',
      headline: 'Remote headline',
      notes: 'Remote notes',
      summary: 'Remote summary'
    },
    branches: {
      remote: {
        status: 'Active',
        progress: 90,
        checkpoints: [{ text: 'Remote checkpoint', done: true }]
      }
    },
    branchOrder: ['remote'],
    updatedAt: '2025-12-19T13:00:00.000Z'
  };

  if (!USE_REAL_SERVER) {
    await page.route(serverSaveUrl, async (route) => {
      let body: any = {};
      try { body = route.request().postDataJSON(); } catch {}
      const revision = 7;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          meta: { revision, updated_at: '2025-12-19T12:00:00.000Z', updated_by: 'playwright' },
          status: body?.status
        }
      });
    });

    await page.route(serverReadUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          status: remoteStatus,
          meta: { revision: 8, updated_at: '2025-12-19T13:00:00.000Z', updated_by: 'remote' }
        }
      });
    });
  }

  if (USE_REAL_SERVER) {
    await page.evaluate(({ saveUrl, readUrl, apiKey }) => {
      localStorage.setItem('tpb_sv_save_url_v1', saveUrl);
      localStorage.setItem('tpb_sv_read_url_v1', readUrl);
      localStorage.setItem('tpb_sv_api_key_v1', apiKey);
      localStorage.setItem('tpb_sv_updated_by_v1', 'playwright-live');
    }, { saveUrl: serverSaveUrl, readUrl: serverReadUrl, apiKey: REAL_API_KEY });
  } else {
    await page.evaluate(({ saveUrl, readUrl }) => {
      localStorage.setItem('tpb_sv_save_url_v1', saveUrl);
      localStorage.setItem('tpb_sv_read_url_v1', readUrl);
      localStorage.setItem('tpb_sv_api_key_v1', 'test-key');
      localStorage.setItem('tpb_sv_updated_by_v1', 'playwright');
    }, { saveUrl: serverSaveUrl, readUrl: serverReadUrl });
  }

  // Create a new data branch before saving
  await page.getByRole('button', { name: 'New Branch' }).click();
  await page.fill('#nbKey', 'playwright-alpha');
  await page.selectOption('#nbStatus', 'Active');
  await page.fill('#nbProgress', '80');
  await page.fill('#nbCheckpoints', 'Kickoff\nIntegration\nUAT');
  await page.getByRole('button', { name: 'Create Branch' }).click();

  await page.getByRole('button', { name: 'Save To Server' }).click();
  if (USE_REAL_SERVER) {
    await expect(page.locator('#saveLabel')).not.toHaveText('Saving…', { timeout: 15000 });
  } else {
    await expect(page.locator('#saveLabel')).toContainText('Saved');
    await expect(page.locator('#saveRev')).toContainText('7');
  }

  await page.getByRole('button', { name: 'Refresh from Server' }).click();
  if (USE_REAL_SERVER) {
    await expect(page.locator('.branch-item').first()).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.locator('#overallHeadline')).toContainText('Remote headline');
    const remoteCard = page.locator('.branch-item[data-branch-key="remote"]');
    await expect(remoteCard).toBeVisible();
    await expect(page.locator('#saveRev')).toContainText('8');
  }
});

test('reorders branches and filters by tag', async ({ page }) => {
  // Create two additional branches
  await page.getByRole('button', { name: 'New Branch' }).click();
  await page.fill('#nbKey', 'beta');
  await page.selectOption('#nbStatus', 'Active');
  await page.fill('#nbProgress', '60');
  await page.getByRole('button', { name: 'Create Branch' }).click();

  await page.getByRole('button', { name: 'New Branch' }).click();
  await page.fill('#nbKey', 'gamma');
  await page.selectOption('#nbStatus', 'Blocked');
  await page.fill('#nbProgress', '10');
  await page.getByRole('button', { name: 'Create Branch' }).click();

  // Filter by tag "ops" (only alpha has it)
  await page.waitForSelector('#filterTag option[value="ops"]', { state: 'attached' });
  await page.selectOption('#filterTag', 'ops');
  await expect(page.locator('.branch-item')).toHaveCount(1);
  await expect(page.locator('.branch-item[data-branch-key="alpha"]')).toBeVisible();

  // Clear filter and reorder: move gamma to top
  await page.click('#filterClear');
  await page.locator('[data-branch-key="gamma"] [data-move-branch="up"]').click();
  await page.locator('[data-branch-key="gamma"] [data-move-branch="up"]').click();

  const order = await page.$$eval('.branch-item', (els) =>
    els.map((el) => el.getAttribute('data-branch-key'))
  );
  expect(order[0]).toBe('gamma');
});

test('backs up and restores dashboard data', async ({ page }) => {
  await page.evaluate(() => {
    // Force fallback path so modal opens without native save dialog.
    // @ts-ignore
    window.showSaveFilePicker = undefined;
  });

  await page.click('#btnBackups');
  await page.locator('#backupsMenu').waitFor({ state: 'visible' });
  await page.click('#btnDashboardBackup');
  await expect(page.locator('#ovDashboardBackup')).toBeVisible();
  await expect(page.locator('#dashboardBackupText')).not.toHaveValue('');

  const restorePayload = {
    status: {
      overall: {
        badge: 'Planned',
        headline: 'Restored overall',
        notes: 'Restored notes',
        summary: ''
      },
      branches: {
        restored: { status: 'Active', progress: 55, checkpoints: [{ text: 'Restored cp', done: false }] }
      },
      branchOrder: ['restored'],
      updatedAt: '2025-12-19T14:00:00.000Z'
    },
    meta: {
      restored: { owner: 'Restorer', tags: ['restored'], dueDate: '2026-01-01', priority: 'High' }
    }
  };

  await page.setInputFiles('#dashboardImportFile', {
    name: 'restore.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(restorePayload))
  });

  await expect(page.locator('#ovDashboardRestoreConfirm')).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#ovDashboardRestoreConfirm')).toBeHidden();

  const restoredCard = page.locator('.branch-item[data-branch-key="restored"]');
  await expect(restoredCard).toBeVisible();
  await expect(restoredCard.locator('.branch-meta')).toContainText('Restorer');
});
