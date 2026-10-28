const { test, expect } = require('@playwright/test')

const EMAIL = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'

function composer(page) {
  return page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
}

function sendButton(page) {
  return page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first()
}

async function acceptGuestTerms(page) {
  const gotIt = page.getByRole('button', { name: /^got it$/i })
  try {
    await gotIt.waitFor({ state: 'visible', timeout: 8_000 })
    await gotIt.click()
  } catch {
    /* already accepted */
  }
}

async function openNewChat(page) {
  const skipOnboarding = page.getByRole('button', { name: /skip onboarding/i })
  if (await skipOnboarding.isVisible().catch(() => false)) {
    await skipOnboarding.click()
  }
  const openSidebar = page.getByRole('button', { name: /open sidebar/i })
  if (await openSidebar.isVisible().catch(() => false)) {
    await openSidebar.click()
  }
  await page.locator('button.parle-chat-sidebar__new-chat').click()
}

test.describe('Guest New Chat abort', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('New Chat during streaming does not restore the draft after refresh', async ({ page }) => {
    await page.goto('/chat')
    await acceptGuestTerms(page)
    const marker = `gate-newchat-${Date.now()}`
    await composer(page).fill(`synthetic stream interrupt ${marker}`)
    await sendButton(page).click()
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    await openNewChat(page)
    await expect(page.getByText(marker)).toHaveCount(0, { timeout: 10_000 })
    await page.reload()
    await acceptGuestTerms(page)
    await expect(page.getByText(marker)).toHaveCount(0)
    const draft = await page.evaluate(() => sessionStorage.getItem('parle.chat.guestDraft.v1'))
    expect(draft == null || !String(draft).includes(marker)).toBeTruthy()
    const users = await page.locator('.parle-chat-msg--user').count()
    expect(users).toBe(0)
  })
})

test.describe('Outcome survey', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('ending a two-turn guest chat shows the pulse and accepts feedback without ReferenceError', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.addInitScript(() => {
      localStorage.removeItem('parle_outcome_survey_day')
      sessionStorage.setItem(
        'parle.chat.guestDraft.v1',
        JSON.stringify({
          messages: [
            {
              id: 'survey-user-1',
              role: 'user',
              text: 'synthetic first turn about a rainy bus ride',
              at: Date.now() - 120_000,
            },
            {
              id: 'survey-assistant-1',
              role: 'assistant',
              text: 'That sounds heavy. I am here with you.',
              at: Date.now() - 60_000,
            },
          ],
          chatModeId: 'cross',
          pendingModeId: 'cross',
          savedAt: Date.now(),
        }),
      )
    })

    await page.goto('/chat')
    await acceptGuestTerms(page)
    await expect(page.locator('.parle-chat-msg--user').first()).toBeVisible({ timeout: 15_000 })
    await composer(page).fill("that's enough for today")
    await sendButton(page).click()
    const pulse = page.getByRole('dialog', { name: /optional check-in/i })
    await expect(pulse).toBeVisible({ timeout: 60_000 })
    await pulse.getByRole('button', { name: /^better$/i }).click()
    await pulse.getByRole('button', { name: /^clearer$/i }).click()
    await expect(pulse).toBeHidden({ timeout: 10_000 })
    expect(errors.filter((text) => /text is not defined|ReferenceError/i.test(text))).toEqual([])
  })
})

test.describe('Guest crisis and persistence', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('crisis hotlines show and the user turn survives reload', async ({ page }) => {
    await page.goto('/chat')
    await acceptGuestTerms(page)
    await composer(page).fill("i don't want to be here anymore")
    await sendButton(page).click()
    await expect(page.getByText(/1-767/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/6389 2222/)).toBeVisible()
    await page.reload()
    await acceptGuestTerms(page)
    await expect(page.getByText(/i don't want to be here anymore/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/1-767/)).toBeVisible()
    const users = await page.locator('.parle-chat-msg--user').count()
    expect(users).toBe(1)
  })
})

test.describe('Older message actions', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('copy, edit, resend and thumbs remain behind older-message menus', async ({ page }) => {
    const messages = []
    for (let i = 0; i < 20; i += 1) {
      const role = i % 2 === 0 ? 'user' : 'assistant'
      messages.push({
        id: `act-${i}`,
        role,
        text: `${role === 'user' ? 'User turn' : 'Assistant turn'} ${i}`,
        at: Date.now() - (20 - i) * 60_000,
      })
    }
    await page.addInitScript((draft) => {
      sessionStorage.setItem('parle.chat.guestDraft.v1', JSON.stringify(draft))
    }, { messages, chatModeId: 'cross', pendingModeId: 'cross', savedAt: Date.now() })
    await page.goto('/chat')
    await acceptGuestTerms(page)

    const firstUser = page.locator('.parle-chat-msg--user').first()
    await firstUser.scrollIntoViewIfNeeded()
    await firstUser.getByRole('button', { name: /message actions/i }).click()
    await expect(firstUser.getByRole('button', { name: /copy message/i })).toBeVisible()
    await expect(firstUser.getByRole('button', { name: /edit message/i })).toBeVisible()
    await expect(firstUser.getByRole('button', { name: /resend message/i })).toBeVisible()

    const firstAssistant = page.locator('.parle-chat-msg--assistant').first()
    await firstAssistant.scrollIntoViewIfNeeded()
    await firstAssistant.getByRole('button', { name: /reply feedback/i }).click()
    await expect(firstAssistant.getByRole('button', { name: /thumbs up/i })).toBeVisible()
  })
})

test.describe('Authenticated stream', () => {
  test('login, stream, and history keep the user turn once', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /^log in$/i }).click()
    await page.waitForURL(/\/(chat|dashboard|home)/, { timeout: 20_000 })
    await page.goto('/chat')
    await acceptGuestTerms(page)
    const marker = `gate-authed-${Date.now()}`
    await composer(page).fill(`synthetic authed check-in about a late train ${marker}`)
    await sendButton(page).click()
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg--assistant:not(.parle-chat-msg--typing)').last()).toBeVisible({
      timeout: 60_000,
    })
    await expect
      .poll(async () => {
        const history = await page.request.get('/api/chat/history')
        if (history.status() !== 200) return ''
        return JSON.stringify(await history.json())
      }, { timeout: 20_000 })
      .toContain(marker)
    await page.reload()
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    const texts = await page.locator('.parle-chat-msg--user .parle-chat-msg__bubble').allTextContents()
    expect(texts.filter((text) => text.includes(marker)).length).toBe(1)
  })
})
