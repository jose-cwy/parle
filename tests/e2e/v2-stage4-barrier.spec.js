const { test, expect } = require('@playwright/test')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const RUN = process.env.RUN_STAGE4_BARRIER_BROWSER === '1'
const EMAIL = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'
const ROOT = path.join(__dirname, '../..')

function setBarrier(frozen) {
  const result = spawnSync(
    process.execPath,
    ['scripts/set-legacy-write-barrier.js', frozen ? '--frozen' : '--live'],
    { cwd: ROOT, env: process.env, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'barrier script failed')
  }
}

test.describe('Stage 4 write barrier', () => {
  test.skip(!RUN, 'set RUN_STAGE4_BARRIER_BROWSER=1')
  test.describe.configure({ timeout: 180_000 })

  test.afterEach(() => {
    try {
      setBarrier(false)
    } catch {
      /* rehearsal cleanup best-effort */
    }
  })

  test('authenticated freeze preserves history and drafts, guest still works', async ({ page, browser }) => {
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

    const marker = `stage4 barrier ${Date.now()}`
    const composer = page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
    await composer.fill(`i just want to disappear ${marker}`)
    const sendLive = page.waitForResponse(
      (res) => res.url().includes('/api/chat/send') && res.request().method() === 'POST',
      { timeout: 45_000 },
    )
    await page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first().click()
    const live = await sendLive
    expect(live.status()).toBe(200)
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 })

    const draft = `keep this unsent draft ${Date.now()}`
    await composer.fill(draft)
    expect(posts.some((url) => url.includes('/api/conversations'))).toBe(false)

    setBarrier(true)

    const frozenSend = page.waitForResponse(
      (res) => res.url().includes('/api/chat/send') && res.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first().click()
    const frozen = await frozenSend
    expect(frozen.status()).toBe(503)
    const frozenBody = await frozen.json().catch(() => ({}))
    expect(frozenBody.error).toBe('history_save_in_progress')

    await expect(page.getByText(/Chat is briefly unavailable/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(composer).toHaveValue(draft)
    await expect(page.getByText(marker).first()).toBeVisible()

    const importRes = await page.evaluate(async () => {
      const res = await fetch('/api/chat/import-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'should not import', createdAt: Date.now() }],
        }),
      })
      const body = await res.json().catch(() => ({}))
      return { status: res.status, error: body.error }
    })
    expect(importRes.status).toBe(503)
    expect(importRes.error).toBe('history_save_in_progress')

    await page.reload()
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Chat is briefly unavailable/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(marker).first()).toHaveCount(1)

    const guestPage = await browser.newPage()
    try {
      await guestPage.goto('/chat')
      await expect(guestPage.getByPlaceholder(/say what's on your mind/i).first()).toBeVisible({
        timeout: 20_000,
      })
      const guestComposer = guestPage
        .getByPlaceholder(/say what's on your mind/i)
        .filter({ visible: true })
        .first()
      await guestComposer.fill('i just want to disappear')
      const guestSend = guestPage.waitForResponse(
        (res) => res.url().includes('/api/chat/guest-send') && res.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await guestPage.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first().click()
      const guest = await guestSend
      expect(guest.status()).toBe(200)
    } finally {
      await guestPage.close()
    }

    setBarrier(false)
    await page.reload()
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 })
    const composerLive = page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
    const after = `stage4 live again ${Date.now()}`
    await composerLive.fill(`i just want to disappear ${after}`)
    const sendAgain = page.waitForResponse(
      (res) => res.url().includes('/api/chat/send') && res.request().method() === 'POST',
      { timeout: 45_000 },
    )
    await page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first().click()
    expect((await sendAgain).status()).toBe(200)
    await expect(page.getByText(after).first()).toBeVisible({ timeout: 20_000 })
  })
})
