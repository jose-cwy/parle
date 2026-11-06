const { test, expect } = require('@playwright/test')

const EMAIL = process.env.TEST_PARLE_EMAIL_D4 || 'testuser_d4@parle.test'
const EMAIL_B = process.env.TEST_PARLE_EMAIL_D4_B || 'testuser_d4_b@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'

async function login(page, email) {
  const token =
    email === EMAIL_B
      ? process.env.TEST_PARLE_SESSION_D4_B
      : process.env.TEST_PARLE_SESSION_D4
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3075'
  if (token) {
    await page.context().addCookies([{ name: 'hs_session', value: token, url: base }])
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
  } else {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /^log in$/i }).click()
    await page.waitForURL(/\/(chat|dashboard|home)/, { timeout: 20_000 })
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
  }
  await page.evaluate(() => {
    try {
      Object.keys(window.localStorage)
        .filter((key) => String(key).startsWith('parle.v2.selectedConversation'))
        .forEach((key) => window.localStorage.removeItem(key))
    } catch {
      /* ignore */
    }
  })
}

async function openSidebar(page) {
  const openSidebar = page.getByRole('button', { name: /open sidebar/i })
  if (await openSidebar.isVisible().catch(() => false)) {
    await openSidebar.click()
  }
}

test.describe('V2-D.4 generation recovery', () => {
  test.use({ navigationTimeout: 90_000 })

  test('owner can read wrap and V2 chats while send is disabled', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page, EMAIL)
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await openSidebar(page)
    await expect(page.getByText('d4-recovery')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Read-only for now')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0)

    const liveChat = page.locator('li button.w-full').first()
    await expect(liveChat).toBeVisible()
    await liveChat.click()
    await expect(page.getByText('d4-v2-live', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit message' })).toHaveCount(0)

    await openSidebar(page)
    await page.getByRole('button', { name: 'Earlier conversations' }).click()
    await expect(page.getByText('Read-only history')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('d4-legacy-first')).toBeVisible()
    await expect(page.getByText('d4-v2-live', { exact: true })).toHaveCount(0)

    await openSidebar(page)
    await expect(page.getByText(/^Archived$/i)).toBeVisible()
  })

  test('account without wrap does not invent earlier history', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page, EMAIL_B)
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await openSidebar(page)
    await expect(page.getByRole('button', { name: 'Earlier conversations' })).toHaveCount(0)
  })
})
