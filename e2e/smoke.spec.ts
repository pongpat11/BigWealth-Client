import { expect, test, type Page } from '@playwright/test'

// Critical journeys against the mock API (any email signs in). Each test gets
// a fresh page load, so mock data starts from its seed every time.

async function signIn(page: Page, target = '/') {
  await page.goto(target)
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Email').fill('demo@bigwealth.app')
  await page.getByLabel('Password').fill('mock-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('signing in lands on the dashboard with a net worth', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Net worth' })).toContainText('฿')
})

test('a protected page returns there after sign-in', async ({ page }) => {
  await signIn(page, '/accounts')
  await expect(page).toHaveURL(/\/accounts$/)
  await expect(page.getByText('KBank Savings').first()).toBeVisible()
})

test('adding an expense shows it in the transactions list', async ({ page }) => {
  await signIn(page, '/transactions')
  await expect(page).toHaveURL(/\/transactions/)

  await page.getByRole('button', { name: /^add$/i }).click()
  await page.getByLabel('Amount').fill('245')
  await page.getByLabel('Category').selectOption({ label: 'Transport' })
  await page.getByLabel('Note (optional)').fill('E2E taxi ride')
  await page.getByRole('button', { name: 'Add transaction' }).click()

  await expect(page.getByText('E2E taxi ride')).toBeVisible()
  await expect(page.getByText('−฿245').first()).toBeVisible()
})

test('unknown routes show the 404 page inside the app', async ({ page }) => {
  await signIn(page, '/no-such-page')
  await expect(page.getByText(/not found/i).first()).toBeVisible()
})

test('logging out returns to the login page', async ({ page, isMobile }) => {
  await signIn(page)
  await expect(page.getByRole('region', { name: 'Net worth' })).toBeVisible()
  if (isMobile) await page.getByRole('link', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login/)

  // The session is gone: protected pages bounce back to login.
  await page.goto('/transactions')
  await expect(page).toHaveURL(/\/login/)
})
