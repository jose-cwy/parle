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

  test('post-grace verification-required screen keeps the account and offers recovery', async ({ page }) => {
    await page.goto('/verify-email/required')
    await expect(page.getByRole('heading', { name: /confirm your email to keep using this space/i })).toBeVisible()
    await expect(page.getByText(/journal, chats, and memories are still here/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /use a different email/i })).toBeVisible()
  })

  test('email recovery never offers account deletion', async ({ page }) => {
    await page.goto('/verify-email/recovery')
    await expect(page.getByRole('heading', { name: /move this space to an email you can open/i })).toBeVisible()
    await expect(page.getByText(/will not delete your space/i)).toBeVisible()
    await expect(page.getByText(/delete/i)).toHaveCount(1)
  })
})
