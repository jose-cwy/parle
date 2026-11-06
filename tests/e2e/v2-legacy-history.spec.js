const { test, expect } = require('@playwright/test')

const EMAIL = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
const EMAIL_B = process.env.TEST_PARLE_EMAIL_B || 'testuser_b@parle.test'
const EMAIL_LEGACY = process.env.TEST_PARLE_EMAIL_LEGACY || 'testuser_legacy@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'
const MARKER = 'v2d3-hist-marker'

function composer(page) {
  return page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
}

function sendButton(page) {
  return page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first()
}

async function setStub(page, kind) {
  await page.evaluate((value) => {
    window.__PARLE_V2_STUB = value
  }, kind)
}

async function login(page, email) {
  const token =
    email === EMAIL_B
      ? process.env.TEST_PARLE_SESSION_B
      : email === EMAIL_LEGACY
        ? process.env.TEST_PARLE_SESSION_LEGACY
        : email === EMAIL
          ? process.env.TEST_PARLE_SESSION_A
          : null
  if (token) {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3075'
    await page.context().addCookies([
      { name: 'hs_session', value: token, url: base },
    ])
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
      const wipe = (store) => {
        Object.keys(store)
          .filter((key) => String(key).startsWith('parle.v2.selectedConversation'))
          .forEach((key) => store.removeItem(key))
      }
      wipe(window.localStorage)
      wipe(window.sessionStorage)
    } catch {
      /* ignore */
    }
  })
}

async function dismissOnboarding(page) {
  const skip = page.getByRole('button', { name: /skip onboarding|^skip$|got it/i }).first()
  if (await skip.isVisible().catch(() => false)) {
    await skip.click()
  }
}

async function openChat(page) {
  if (!/\/chat/.test(page.url())) {
    await page.goto('/chat')
  }
  await dismissOnboarding(page)
}

async function openSidebar(page) {
  const openSidebar = page.getByRole('button', { name: /open sidebar/i })
  if (await openSidebar.isVisible().catch(() => false)) {
    await openSidebar.click()
  }
}

test.describe('V2-D.3 read-only legacy history', () => {
  test.use({ navigationTimeout: 90_000 })
  test('account without a wrapper does not invent earlier history', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page, EMAIL_B)
    await openChat(page)
    await openSidebar(page)
    await expect(page.getByRole('button', { name: 'Earlier conversations' })).toHaveCount(0)
    await expect(composer(page)).toBeVisible()
  })

  test('legacy wrapper is read-only, paginated, and isolated from new chats', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page, EMAIL_LEGACY)
    await openChat(page)
    await openSidebar(page)
    const legacyBtn = page.getByRole('button', { name: 'Earlier conversations' })
    await expect(page.getByText('legacy-fixture')).toBeVisible({ timeout: 20_000 })
    await expect(legacyBtn).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/not one original chat/i)).toBeVisible()
    await expect(composer(page)).toBeVisible()

    await legacyBtn.click()
    await expect(page.getByText('Read-only history')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(`${MARKER}-first`)).toBeVisible()
    await expect(sendButton(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit message' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Resend message' })).toHaveCount(0)

    const loadMore = page.getByRole('button', { name: 'Load more history' })
    if (await loadMore.isVisible().catch(() => false)) {
      await loadMore.click()
      await expect(page.getByText(`${MARKER}-first`)).toBeVisible()
      await expect(page.getByText(`${MARKER}-last`)).toBeVisible({ timeout: 20_000 })
    }

    await page.goto('/journal')
    await page.goto('/chat')
    await openChat(page)
    await expect(page.getByText('Read-only history')).toBeVisible({ timeout: 20_000 })

    await page.reload()
    await openChat(page)
    await expect(page.getByText('Read-only history')).toBeVisible({ timeout: 20_000 })
    await expect(sendButton(page)).toHaveCount(0)

    await openSidebar(page)
    await page.locator('button.parle-chat-sidebar__new-chat').click()
    await expect(page.getByText('Read-only history')).toHaveCount(0)
    await expect(composer(page)).toBeVisible()
    await setStub(page, 'ok')
    const liveMarker = `v2d3-live-${Date.now()}`
    await composer(page).fill(`new independent chat ${liveMarker}`)
    await expect(sendButton(page)).toBeEnabled()
    await sendButton(page).click()
    await expect(page.getByText(liveMarker)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(`${MARKER}-first`)).toHaveCount(0)
    await expect(page.getByText('Read-only history')).toHaveCount(0)
    await expect(page.getByText('stub-ok')).toBeVisible({ timeout: 20_000 })

    await openSidebar(page)
    await page.getByRole('button', { name: 'Earlier conversations' }).click()
    await expect(page.getByText(`${MARKER}-first`)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(liveMarker)).toHaveCount(0)
    await expect(sendButton(page)).toHaveCount(0)
  })
})
