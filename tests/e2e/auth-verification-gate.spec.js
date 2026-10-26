const { test, expect } = require('@playwright/test')

const LEGACY_EMAIL = process.env.GATE_LEGACY_EMAIL || ''
const LEGACY_PASSWORD = process.env.GATE_LEGACY_PASSWORD || ''
const googlePublic = process.env.NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN !== 'false'

test.describe('Email verification security gate — UI', () => {
  test('signup lands on pending verification, not the dashboard', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })

  test('Google stays hidden while the public flag is off', async ({ page }) => {
    test.skip(googlePublic, 'Google is public in this environment')
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /continue with google/i })).toHaveCount(0)
  })

  test('pending verification screen is recoverable', async ({ page }) => {
    await page.goto('/verify-email/pending')
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /resend confirmation/i })).toBeVisible()
  })

  test('verification-required page keeps the account', async ({ page }) => {
    await page.goto('/verify-email/required')
    await expect(page.getByRole('heading', { name: /confirm your email to keep using this space/i })).toBeVisible()
    await expect(page.getByText(/journal, chats, and memories are still here/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /use a different email/i })).toBeVisible()
  })

  test('lost-email recovery requires password and forbids deletion', async ({ page }) => {
    await page.goto('/verify-email/recovery')
    await expect(page.getByRole('heading', { name: /move this space to an email you can open/i })).toBeVisible()
    await expect(page.getByLabel('New email')).toBeVisible()
    await expect(page.getByLabel('Current password')).toBeVisible()
    await expect(page.getByText(/will not delete your space/i)).toBeVisible()
    await expect(page.getByText(/delete/i)).toHaveCount(1)
  })

  test('legacy unverified dashboard shows a readable confirmation notice', async ({ page }) => {
    test.skip(!LEGACY_EMAIL || !LEGACY_PASSWORD, 'legacy gate credentials not provided')
    await page.goto('/login')
    await page.getByLabel('Email').fill(LEGACY_EMAIL)
    await page.getByLabel('Password').fill(LEGACY_PASSWORD)
    await page.getByRole('button', { name: /^log in$/i }).click()
    await expect(page.getByText(/confirm this email is yours/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /send confirmation/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /i can’t use this email/i })).toBeVisible()
  })

  test('guest chat remains available without an account', async ({ page }) => {
    await page.goto('/chat')
    const gotIt = page.getByRole('button', { name: /^got it$/i })
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click()
    await expect(page).toHaveURL(/\/chat/)
    await expect(page.locator('textarea.parle-chat-input__textarea').first()).toBeAttached({ timeout: 20_000 })
  })
})
