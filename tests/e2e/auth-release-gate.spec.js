const { test, expect } = require('@playwright/test')

test.describe('Auth release gate — MOCKED UI', () => {
  test('pending verification stays on Check your email and does not auto-open Login', async ({ page }) => {
    await page.goto('/verify-email/pending')
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /^log in$/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /start free/i })).toHaveCount(0)
  })

  test('failed mail query keeps the pending screen recoverable', async ({ page }) => {
    await page.goto('/verify-email/pending?mail=failed&email=synthetic-auth@parle.test')
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()
    await expect(page.getByText(/could not send the confirmation email/i)).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('synthetic-auth@parle.test')
  })

  test('login checking state is not a blank unresponsive page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible()
  })

  test('register does not silently bounce a signed-out visitor to login', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })
})
