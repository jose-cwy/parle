const { test, expect } = require('@playwright/test')

const RUN = process.env.RUN_STAGE3_BROWSER === '1'
const EMAIL = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'

test.describe('Stage 3 legacy chatbot', () => {
  test.skip(!RUN, 'set RUN_STAGE3_BROWSER=1')

  test('authenticated New Chat, send, and refresh stay on chat_memory', async ({ page }) => {
    const posts = []
    page.on('request', (req) => {
      if (req.method() === 'POST' || req.method() === 'PATCH') posts.push(`${req.method()} ${req.url()}`)
    })

    await page.goto('/login')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /^log in$/i }).click()
    await page.waitForURL(/\/(chat|dashboard|home)/, { timeout: 20_000 })
    await page.goto('/chat')

    await expect(page.getByPlaceholder(/say what's on your mind/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-sidebar__legacy')).toHaveCount(0)

    await page.getByText('New Chat', { exact: true }).first().click()
    await expect(page.locator('.parle-chat-layout--empty')).toBeVisible({ timeout: 15_000 })

    const marker = `stage3 freeze ${Date.now()}`
    const composer = page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
    await composer.fill(`i just want to disappear ${marker}`)
    const send = page.waitForResponse(
      (res) => res.url().includes('/api/chat/send') && res.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first().click()
    const sent = await send
    expect(sent.status()).toBe(200)

    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/1-767/).first()).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 })

    expect(posts.some((url) => url.includes('/api/conversations'))).toBe(false)
  })

  test('guest composer uses guest-send and does not show V2 history chrome', async ({ page }) => {
    const posts = []
    page.on('request', (req) => {
      if (req.method() === 'POST') posts.push(req.url())
    })
    await page.goto('/chat')
    await expect(page.getByPlaceholder(/say what's on your mind/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-sidebar__legacy')).toHaveCount(0)

    const composer = page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
    await composer.fill('i just want to disappear')
    const send = page.waitForResponse(
      (res) => res.url().includes('/api/chat/guest-send') && res.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first().click()
    const sent = await send
    expect(sent.status()).toBe(200)
    await expect(page.getByText(/1-767/).first()).toBeVisible({ timeout: 15_000 })
    expect(posts.some((url) => url.includes('/api/conversations'))).toBe(false)
    expect(posts.some((url) => url.includes('/api/chat/send'))).toBe(false)
  })
})
