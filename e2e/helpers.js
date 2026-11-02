import fs from 'node:fs';
import { expect } from '@playwright/test';

export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Reads the newest development email link for an address from the API log (MAIL_TRANSPORT=log). */
export async function emailLink(to, path) {
  const file = process.env.E2E_API_LOG;
  if (!file) throw new Error('Set E2E_API_LOG to the API log file');
  for (let i = 0; i < 40; i += 1) {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('"to":"' + to + '"'));
    for (const line of lines.reverse()) {
      const m = new RegExp(`(https?://[^\\s"]+${path}\\?token=[A-Za-z0-9_-]+)`).exec(line);
      if (m) return new URL(m[1]).pathname + new URL(m[1]).search;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${path} email found for ${to}`);
}

export async function register(page, { company, email, password, first = 'Olivia' }) {
  await page.goto('/register');
  await page.getByLabel('Company name').fill(company);
  await page.getByLabel('First name').fill(first);
  await page.getByLabel('Last name').fill('Tester');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  await page.goto(await emailLink(email, '/verify-email'));
  await expect(page.getByText('Your email address is verified.')).toBeVisible();
  await page.getByRole('link', { name: 'Continue to your workspace' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}
