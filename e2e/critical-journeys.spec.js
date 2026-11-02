import { test, expect } from '@playwright/test';
import { register, emailLink, uniq } from './helpers';

/**
 * Critical journey (docs/TESTING.md §E2E):
 *  1 company signs up · 2 admin invites a user · 3 creates a custom role · 4 assigns permissions
 *  5 user creates a lead · 6 converts it · 7 moves the deal through stages
 *  8 timeline + audit events recorded · 9 user generates a report · 10 another tenant is denied
 */
test('full multi-tenant sales journey', async ({ browser }) => {
  const id = uniq();
  const ownerEmail = `owner-${id}@example.test`;
  const repEmail = `rep-${id}@example.test`;
  const password = 'E2e-Secret-Pass-1!';

  // 1. Company signs up and creates a tenant.
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, { company: `Acme ${id}`, email: ownerEmail, password });

  // 3 + 4. Create a custom role and assign permissions in the matrix.
  await owner.goto('/settings/roles');
  await owner.getByRole('button', { name: 'New role' }).click();
  await owner.getByLabel('Role name').fill('Field Sales');
  await owner.getByRole('button', { name: 'Create' }).click();
  await expect(owner.getByRole('heading', { name: 'Field Sales' })).toBeVisible();
  for (const perm of ['View dashboard', 'View leads', 'Create leads', 'Edit leads', 'Convert leads', 'View contacts', 'Create contacts', 'View accounts', 'Create accounts',
    'View opportunities', 'Create opportunities', 'Edit opportunities', 'View activities', 'Create activities', 'View reports & analytics']) {
    await owner.getByRole('checkbox', { name: perm, exact: true }).check();
  }
  await owner.getByRole('button', { name: 'Save changes' }).click();
  await expect(owner.getByText('Role saved')).toBeVisible();

  // 2. Invite a user with the custom role.
  await owner.goto('/settings/users');
  await owner.getByRole('button', { name: 'Invite user' }).click();
  await owner.getByLabel('Email').fill(repEmail);
  await owner.getByRole('checkbox', { name: /Field Sales/ }).check();
  await owner.getByRole('button', { name: 'Send invitation' }).click();
  await expect(owner.getByText(`Invitation sent to ${repEmail}`)).toBeVisible();

  const repCtx = await browser.newContext();
  const rep = await repCtx.newPage();
  await rep.goto(await emailLink(repEmail, '/accept-invite'));
  await rep.getByLabel('First name').fill('Riley');
  await rep.getByLabel('Last name').fill('Rep');
  await rep.getByLabel('Password').fill(password);
  await rep.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(rep.getByRole('heading', { name: /Good (morning|afternoon|evening), Riley/ })).toBeVisible();
  // Least privilege: no settings or quotes navigation for this role.
  await expect(rep.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await expect(rep.getByRole('link', { name: 'Quotes' })).toHaveCount(0);

  // 5. The user creates a lead.
  await rep.goto('/leads');
  await rep.getByRole('button', { name: 'New lead' }).click();
  await rep.getByLabel('First name').fill('Grace');
  await rep.getByLabel('Last name').fill('Hopper');
  await rep.getByLabel('Email', { exact: true }).fill(`grace-${id}@navy.example.test`);
  await rep.getByLabel('Company').fill(`Navy Labs ${id}`);
  await rep.getByRole('button', { name: 'Create lead' }).click();
  await expect(rep.getByRole('heading', { name: /Grace Hopper/ })).toBeVisible();

  // 6. Convert the lead into contact, account and opportunity.
  await rep.getByRole('button', { name: 'Convert' }).click();
  await rep.getByLabel('Amount').fill('25000');
  await rep.getByRole('dialog').getByRole('button', { name: 'Convert' }).click();
  await expect(rep.getByRole('heading', { name: new RegExp(`Navy Labs ${id} deal`) })).toBeVisible();
  const oppUrl = rep.url();

  // 7. Move the opportunity through pipeline stages.
  for (const stage of ['Needs analysis', 'Proposal', 'Negotiation']) {
    await rep.getByRole('list', { name: 'Stages' }).getByRole('listitem').filter({ hasText: stage }).click();
    await expect(rep.getByText(`Moved to ${stage}`)).toBeVisible();
  }
  await expect(rep.getByRole('list', { name: 'Stages' }).getByRole('listitem').filter({ hasText: 'Negotiation' })).toHaveAttribute('aria-current', 'step');

  // 8. Activity timeline and audit events.
  await rep.reload();
  await expect(rep.getByText('Stage changed from Proposal to Negotiation')).toBeVisible();
  await owner.goto('/settings/audit');
  await owner.getByLabel('Action filter').fill('lead.converted');
  await expect(owner.getByText(/Lead "Grace Hopper.*converted to contact, account and opportunity/)).toBeVisible();

  // 9. The user generates a report.
  await rep.goto('/reports');
  await rep.getByRole('tab', { name: 'Report builder' }).click();
  await rep.getByRole('button', { name: 'Run' }).click();
  await expect(rep.getByRole('cell', { name: 'open' })).toBeVisible();

  // 10. A different tenant tries to open the same record and is denied.
  const otherCtx = await browser.newContext();
  const other = await otherCtx.newPage();
  await register(other, { company: `Globex ${id}`, email: `intruder-${id}@example.test`, password });
  await other.goto(new URL(oppUrl).pathname);
  await expect(other.getByText('Not found', { exact: true })).toBeVisible();
  await expect(other.getByText('Opportunity not found')).toBeVisible();
  const status = await other.evaluate(async (path) => (await fetch(`/api/v1${path}`)).status, new URL(oppUrl).pathname);
  expect(status).toBe(404);

  await Promise.all([ownerCtx.close(), repCtx.close(), otherCtx.close()]);
});

test('login rejects wrong credentials and unauthenticated users are redirected', async ({ page }) => {
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login\?next=%2Fleads/);
  await page.getByLabel('Work email').fill(`nobody-${uniq()}@example.test`);
  await page.getByLabel('Password').fill('definitely-wrong-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
});
