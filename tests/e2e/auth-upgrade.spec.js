const { test, expect } = require('@playwright/test')

test.describe('Auth upgrade UI', () => {
  test('login offers Google and email', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /continue with google/i })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('register offers Google after the page loads', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText(/continue with google/i)).toBeVisible()
  })

  test('pending verification screen can request a resend', async ({ page }) => {
    await page.goto('/verify-email/pending')
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()
    await page.getByLabel('Email').fill('synthetic-auth@parle.test')
    await page.getByRole('button', { name: /resend confirmation/i }).click()
    await expect(page.getByRole('status')).toBeVisible({ timeout: 15_000 })
  })

  test('verify page does not auto-consume a token on GET', async ({ page }) => {
    await page.goto('/verify-email?token=scanner-token')
    await expect(page.getByRole('button', { name: /confirm my email/i })).toBeVisible()
  })
})
