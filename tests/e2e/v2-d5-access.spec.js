const { test, expect } = require('@playwright/test')

const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'

async function login(page, email, token) {
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
}

async function openSidebar(page) {
  const openSidebar = page.getByRole('button', { name: /open sidebar/i })
  if (await openSidebar.isVisible().catch(() => false)) {
    await openSidebar.click()
  }
}

test.describe('V2-D.5 migration access', () => {
  test.use({ navigationTimeout: 90_000 })

  test('legacy-only account does not invent earlier conversations', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page, 'testuser_d5_legacyonly@parle.test', process.env.TEST_PARLE_SESSION_D5_LEGACYONLY)
    await openSidebar(page)
    await expect(page.getByText('d5-legacyonly')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Earlier conversations' })).toHaveCount(0)
  })

  test('incomplete wrap is labeled and remains read-only', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page, 'testuser_d5_incomplete@parle.test', process.env.TEST_PARLE_SESSION_D5_INCOMPLETE)
    await openSidebar(page)
    await expect(page.getByText('d5-incomplete')).toBeVisible({ timeout: 20_000 })
    const earlier = page.getByRole('button', { name: 'Earlier conversations' })
    await expect(earlier).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/still incomplete|may still receive/i)).toBeVisible()
    await earlier.click()
    await expect(page.getByText('Read-only history')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0)
    await expect(page.getByText('d5-inc-first')).toBeVisible()
  })

  test('completed wrap and live V2 chat both remain readable', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page, 'testuser_d4@parle.test', process.env.TEST_PARLE_SESSION_D4)
    await openSidebar(page)
    await expect(page.getByText('d4-recovery')).toBeVisible({ timeout: 20_000 })
    const liveChat = page.locator('li button.w-full').first()
    await expect(liveChat).toBeVisible()
    await liveChat.click()
    await expect(page.getByText('d4-v2-live', { exact: true })).toBeVisible({ timeout: 20_000 })
    await openSidebar(page)
    await page.getByRole('button', { name: 'Earlier conversations' }).click()
    await expect(page.getByText('d4-legacy-first')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('d4-v2-live', { exact: true })).toHaveCount(0)
  })
})
