const { test, expect } = require('@playwright/test')

const EMAIL = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
const EMAIL_B = process.env.TEST_PARLE_EMAIL_B || 'testuser_b@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'

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

async function login(page, email = EMAIL) {
  const token =
    email === EMAIL_B
      ? process.env.TEST_PARLE_SESSION_B
      : process.env.TEST_PARLE_SESSION_A
  if (token) {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3075'
    await page.context().addCookies([
      { name: 'hs_session', value: token, url: base },
    ])
    const listed = page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        /\/api\/conversations\/?(\?|$)/.test(res.url()) &&
        !res.url().includes('/legacy'),
      { timeout: 20_000 },
    )
    await Promise.all([page.goto('/chat'), listed.catch(() => {})])
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
    return
  }
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL(/\/(chat|dashboard|home)/, { timeout: 20_000 })
  const listed = page.waitForResponse(
    (res) =>
      res.request().method() === 'GET' &&
      /\/api\/conversations\/?(\?|$)/.test(res.url()) &&
      !res.url().includes('/legacy'),
    { timeout: 20_000 },
  )
  await Promise.all([page.goto('/chat'), listed.catch(() => {})])
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

async function newChat(page) {
  await openSidebar(page)
  const created = page.waitForResponse((res) => {
    if (res.request().method() !== 'POST') return false
    try {
      const path = new URL(res.url()).pathname.replace(/\/$/, '')
      return path === '/api/conversations'
    } catch {
      return false
    }
  }, { timeout: 20_000 })
  await page.locator('button.parle-chat-sidebar__new-chat').click()
  const response = await created
  await expect(composer(page)).toBeEnabled({ timeout: 20_000 })
  return response
}

function conversationIdFromMessagesUrl(url) {
  const match = String(url).match(/\/api\/conversations\/([0-9a-f-]{36})\/messages/i)
  return match ? match[1] : null
}

async function archiveConversationById(page, conversationId) {
  const archive = page.locator(
    `.parle-chat-sidebar__session-action[title="Archive"][data-conversation-id="${conversationId}"]`,
  )
  await expect(archive).toBeVisible({ timeout: 20_000 })
  await archive.click()
}

async function sendTurn(page, text) {
  const posted = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' &&
      /\/api\/conversations\/[0-9a-f-]{36}\/messages/i.test(res.url()),
    { timeout: 20_000 },
  )
  await composer(page).fill(text)
  await expect(sendButton(page)).toBeEnabled()
  await sendButton(page).click()
  return posted
}

function historyButtons(page) {
  return page.locator('.parle-chat-sidebar__history li button.w-full')
}

function conversationIdFromUrl(page) {
  try {
    return new URL(page.url()).searchParams.get('c')
  } catch {
    return null
  }
}

test.describe('V2 conversation isolation', () => {
  test('A: Chat 1 completes then Chat 2 stays separate across switch and refresh', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await setStub(page, 'ok')
    await newChat(page)
    const marker1 = `v2c1-a1-${Date.now()}`
    await sendTurn(page, `synthetic first conversation ${marker1}`)
    await expect(page.getByText(marker1)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })

    await newChat(page)
    await expect(page.getByText(marker1)).toHaveCount(0)
    const marker2 = `v2c1-a2-${Date.now()}`
    await sendTurn(page, `synthetic second conversation ${marker2}`)
    await expect(page.getByText(marker2)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(marker1)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await openSidebar(page)
    const items = historyButtons(page)
    expect(await items.count()).toBeGreaterThan(1)
    await items.nth(1).click()
    await expect(page.getByText(new RegExp(`${marker1}|${marker2}`))).toBeVisible({ timeout: 20_000 })
    expect((await page.getByText(marker1).count()) > 0 && (await page.getByText(marker2).count()) > 0).toBeFalsy()

    await page.reload()
    await openChat(page)
    expect(
      (await page.getByText(marker1).count()) > 0 && (await page.getByText(marker2).count()) > 0,
    ).toBeFalsy()
    await composer(page).fill('recover composer after refresh')
    await expect(sendButton(page)).toBeEnabled()
  })

  test('B: New Chat during Chat 1 stream then send in Chat 2', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await newChat(page)
    await setStub(page, 'drip')
    const marker1 = `v2c1-b1-${Date.now()}`
    await sendTurn(page, `streaming then leave ${marker1}`)
    await expect(page.getByText(marker1)).toBeVisible({ timeout: 10_000 })
    await newChat(page)
    await expect(page.getByText(marker1)).toHaveCount(0)
    await setStub(page, 'ok')
    const marker2 = `v2c1-b2-${Date.now()}`
    await sendTurn(page, `independent second ${marker2}`)
    await expect(page.getByText(marker2)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(marker1)).toHaveCount(0)
    await dismissOnboarding(page)
    await composer(page).fill('composer after new chat during stream')
    await expect(sendButton(page)).toBeEnabled()
  })

  test('C: switch conversations while a response is streaming', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await newChat(page)
    await setStub(page, 'ok')
    const marker1 = `v2c1-c1-${Date.now()}`
    await sendTurn(page, `first completed ${marker1}`)
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })
    await newChat(page)
    const marker2 = `v2c1-c2-${Date.now()}`
    await sendTurn(page, `second completed ${marker2}`)
    await expect(page.getByText(marker2)).toBeVisible({ timeout: 20_000 })

    await openSidebar(page)
    await historyButtons(page).nth(1).click()
    await expect(page.getByText(marker1)).toBeVisible({ timeout: 20_000 })
    await setStub(page, 'drip')
    const streamMarker = `v2c1-c-stream-${Date.now()}`
    await sendTurn(page, `switch while streaming ${streamMarker}`)
    await expect(page.getByText(streamMarker)).toBeVisible({ timeout: 10_000 })
    await openSidebar(page)
    await historyButtons(page).nth(0).click()
    await expect(page.getByText(marker2)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(streamMarker)).toHaveCount(0)
    await composer(page).fill('composer after switch during stream')
    await expect(sendButton(page)).toBeEnabled()
  })

  test('D: refresh during streaming then reopen', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await newChat(page)
    await setStub(page, 'drip')
    const streamMarker = `v2c1-c-stream-${Date.now()}`
    await sendTurn(page, `switch while streaming ${streamMarker}`)
    await expect(page.getByText(streamMarker)).toBeVisible({ timeout: 10_000 })
    await newChat(page)
    await expect(page.getByText(streamMarker)).toHaveCount(0)
    const marker = `v2c1-d-${Date.now()}`
    const posted = await sendTurn(page, `refresh mid stream ${marker}`)
    expect(posted.ok()).toBe(true)
    const postId = conversationIdFromMessagesUrl(posted.url())
    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(streamMarker)).toHaveCount(0)
    await expect.poll(() => conversationIdFromUrl(page)).toBe(postId)
    const conversationId = conversationIdFromUrl(page)
    expect(conversationId).toBe(postId)
    await page.reload()
    await openChat(page)
    await expect(page).toHaveURL(new RegExp(`[?&]c=${conversationId}`))
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg').getByText(streamMarker)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await composer(page).fill('composer after interrupted refresh')
    await expect(sendButton(page)).toBeEnabled()
  })

  test('E: Journal then return keeps the selected conversation', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await newChat(page)
    await setStub(page, 'ok')
    const marker = `v2c1-e-${Date.now()}`
    await sendTurn(page, `journal roundtrip ${marker}`)
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })
    await page.goto('/journal')
    await expect(page).toHaveURL(/journal/)
    await page.goto('/chat')
    await openChat(page)
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await composer(page).fill('composer after journal')
    await expect(sendButton(page)).toBeEnabled()
  })

  test('F: two tabs send to the same conversation', async ({ page, context }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await newChat(page)
    await setStub(page, 'ok')
    const shared = `v2c1-f-shared-${Date.now()}`
    await sendTurn(page, `shared conversation ${shared}`)
    await expect(page.getByText(shared)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })
    const onboarding = page.getByRole('dialog', { name: /quick question so i can show up better/i })
    if (await onboarding.isVisible().catch(() => false)) {
      await expect(sendButton(page)).toBeEnabled()
      await dismissOnboarding(page)
      await expect(onboarding).toHaveCount(0)
    }

    const page2 = await context.newPage()
    await page2.goto('/chat')
    await openChat(page2)
    await expect(page2.getByText(shared)).toBeVisible({ timeout: 20_000 })

    await setStub(page, 'slow')
    await setStub(page2, 'slow')
    const tab1 = `v2c1-f-tab1-${Date.now()}`
    const tab2 = `v2c1-f-tab2-${Date.now()}`
    await sendTurn(page, `tab one ${tab1}`)
    await sendTurn(page2, `tab two ${tab2}`)
    await expect(page.getByText(tab1)).toBeVisible({ timeout: 10_000 })
    await expect(page2.getByText(tab2)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(shared)).toBeVisible()
    await expect(page2.getByText(shared)).toBeVisible()
    await composer(page).fill('composer after two-tab send')
    await expect(sendButton(page)).toBeEnabled({ timeout: 20_000 })
    await composer(page2).fill('composer after two-tab send')
    await expect(sendButton(page2)).toBeEnabled({ timeout: 20_000 })
    await page2.close()
  })

  test('G: archive Chat 2 persists across refresh and Journal return', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await newChat(page)
    await setStub(page, 'ok')
    const marker1 = `v2c1-g1-${Date.now()}`
    await sendTurn(page, `keep active ${marker1}`)
    await expect(page.getByText(marker1)).toBeVisible({ timeout: 20_000 })
    const id1 = conversationIdFromUrl(page)
    const created2 = await newChat(page)
    const created2Body = await created2.json()
    const created2Id = created2Body?.conversation?.id
    expect(created2Id).toBeTruthy()
    const marker2 = `v2c1-g2-${Date.now()}`
    const posted2 = await sendTurn(page, `will archive ${marker2}`)
    expect(posted2.ok()).toBe(true)
    const postId2 = conversationIdFromMessagesUrl(posted2.url())
    const headerId2 = posted2.headers()['x-parle-conversation-id']
    await expect(page.getByText(marker2)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => conversationIdFromUrl(page)).toBe(created2Id)
    const id2 = conversationIdFromUrl(page)
    expect(postId2, 'Chat 2 POST UUID must equal New Chat UUID').toBe(created2Id)
    expect(headerId2 || postId2).toBe(created2Id)
    expect(id2, 'URL UUID must equal Chat 2 POST UUID').toBe(postId2)
    expect(id2).not.toBe(id1)
    const persisted = await page.request.get(`/api/conversations/${id2}`)
    expect(persisted.ok()).toBe(true)
    const persistedBody = await persisted.json()
    expect(
      persistedBody.messages.some((row) => String(row.text || '').includes(marker2)),
      'chat 2 marker missing from GET before archive',
    ).toBe(true)
    await openSidebar(page)

    await archiveConversationById(page, id2)
    await expect(page.getByText(marker2)).toHaveCount(0)
    await expect(page.getByText(/^Archived$/i)).toBeVisible()
    const restore = page.locator(`.parle-chat-sidebar__restore[data-conversation-id="${id2}"]`)
    await expect(restore).toBeVisible()

    await page.reload()
    await openChat(page)
    await openSidebar(page)
    await expect(page.getByText(marker2)).toHaveCount(0)
    await expect(page.getByText(/^Archived$/i)).toBeVisible()
    await expect(page.locator(`.parle-chat-sidebar__restore[data-conversation-id="${id2}"]`)).toBeVisible()
    await page.goto('/journal')
    await page.goto('/chat')
    await openChat(page)
    await openSidebar(page)
    await expect(page.getByText(/^Archived$/i)).toBeVisible()
    const restoreAfterJournal = page.locator(`.parle-chat-sidebar__restore[data-conversation-id="${id2}"]`)
    await expect(restoreAfterJournal).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const restorePatch = page.waitForResponse(
      (res) =>
        res.request().method() === 'PATCH' &&
        res.url().includes(`/api/conversations/${id2}`),
    )
    const restoreGet = page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        res.url().includes(`/api/conversations/${id2}`),
    )
    await restoreAfterJournal.click()
    const restoreRes = await restorePatch
    expect(restoreRes.status(), `restore PATCH ${restoreRes.status()}`).toBe(200)
    const getRes = await restoreGet
    expect(getRes.status(), `restore GET ${getRes.status()}`).toBe(200)
    const getBody = await getRes.json()
    expect(Array.isArray(getBody.messages)).toBe(true)
    expect(getBody.messages.some((row) => String(row.text || '').includes(marker2))).toBe(true)
    await expect(page).toHaveURL(new RegExp(`[?&]c=${id2}`))
    await expect(page.getByText(marker2)).toBeVisible({ timeout: 20_000 })
    expect(conversationIdFromUrl(page)).toBe(id2)
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible()

    await page.goto(`/chat?c=${id1}`)
    await openChat(page)
    await expect(page.getByText(marker1)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(marker2)).toHaveCount(0)

    await openSidebar(page)
    await archiveConversationById(page, id1)
    await expect(page.getByText(/^Archived$/i)).toBeVisible()
    const restoreKeyboard = page.locator(`.parle-chat-sidebar__restore[data-conversation-id="${id1}"]`)
    await restoreKeyboard.focus()
    await expect(restoreKeyboard).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText(marker1)).toBeVisible({ timeout: 20_000 })
  })

  test('H: provider failure and timeout keep the user message', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await newChat(page)
    await setStub(page, 'fail')
    const failMarker = `v2c1-h-fail-${Date.now()}`
    await sendTurn(page, `provider fail ${failMarker}`)
    await expect(page.getByText(failMarker)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/your message is saved|did not come through|try again/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await composer(page).fill('retry after fail')
    await expect(sendButton(page)).toBeEnabled()

    await setStub(page, 'timeout')
    const timeoutMarker = `v2c1-h-timeout-${Date.now()}`
    await sendTurn(page, `provider timeout ${timeoutMarker}`)
    await expect(page.getByText(timeoutMarker)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/your message is saved|did not come through|try again/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await composer(page).fill('retry after timeout')
    await expect(sendButton(page)).toBeEnabled()
  })

  test('account B does not see account A conversation markers', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page, EMAIL_B)
    await openChat(page)
    const leaked = await page.getByText(/v2c1-[a-z0-9-]+/).count()
    expect(leaked).toBe(0)
  })
})
