import { test, expect } from '@playwright/test';

const ROLES = [
  { role: 'Student', home: '/dashboard', links: ['Events', 'My tickets'] },
  { role: 'Club', home: '/club', links: ['Events', 'Scanner', 'Club dashboard'] },
  { role: 'Admin', home: '/admin', links: ['Events', 'Scanner', 'Admin'] },
];
const PATHS = { Events: '/events', 'My tickets': '/dashboard', 'Club dashboard': '/club', Scanner: '/scan', Admin: '/admin' };

let errors;
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
});
test.afterEach(() => {
  expect(errors, 'uncaught errors in the page').toEqual([]);
});

const primaryNav = (page) => page.getByRole('navigation', { name: 'Primary' });

async function expectRendered(page, path) {
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('main h1').first()).toBeVisible();
}

test('anonymous visitors can move between public pages', async ({ page }) => {
  await page.goto('/');
  await primaryNav(page).getByRole('link', { name: 'Events' }).click();
  await expectRendered(page, '/events');
  await page.locator('main a[href^="/events/"]').first().click();
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('link', { name: 'EventSphere home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const { role, home, links } of ROLES) {
  test(`${role} demo login and navbar navigation`, async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: new RegExp(`^${role}\\b`) }).click();
    await expectRendered(page, home);

    for (const name of links) {
      await primaryNav(page).getByRole('link', { name, exact: true }).click();
      await expectRendered(page, PATHS[name]);
    }

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });
}
