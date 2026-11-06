const { test, expect } = require('@playwright/test')

const EMAIL = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'

function composer(page) {
  return page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
}

function sendButton(page) {
  return page.getByRole('button', { name: 'Send', exact: true }).filter({ visible: true }).first()
}

function conversationIdFromUrl(page) {
  try {
    return new URL(page.url()).searchParams.get('c')
  } catch {
    return null
  }
}

function conversationIdFromMessagesUrl(url) {
  const match = String(url).match(/\/api\/conversations\/([0-9a-f-]{36})\/messages/i)
  return match ? match[1] : null
}

function sanitizePath(url) {
  try {
    return new URL(url).pathname.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    )
  } catch {
    return 'invalid-url'
  }
}

async function login(page) {
  const token = process.env.TEST_PARLE_SESSION_A
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3082'
  const listed = page.waitForResponse(
    (res) =>
      res.request().method() === 'GET' &&
      /\/api\/conversations\/?(\?|$)/.test(res.url()) &&
      !res.url().includes('/legacy'),
    { timeout: 20_000 },
  )
  if (token) {
    await page.context().addCookies([{ name: 'hs_session', value: token, url: base }])
    await Promise.all([page.goto('/chat'), listed.catch(() => {})])
  } else {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /^log in$/i }).click()
    await page.waitForURL(/\/(chat|dashboard|home)/, { timeout: 20_000 })
    await Promise.all([page.goto('/chat'), listed.catch(() => {})])
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

async function inspectConversation(id) {
  if (!id) return { messages: [], requests: [] }
  const db = require('../../lib/db')
  const messages = await db.query(
    `SELECT id, conversation_id, role, seq
     FROM conversation_messages
     WHERE conversation_id = $1
     ORDER BY seq`,
    [id],
  )
  const requests = await db.query(
    `SELECT id, conversation_id, status, user_message_id, assistant_message_id, error_code
     FROM conversation_requests
     WHERE conversation_id = $1
     ORDER BY updated_at DESC`,
    [id],
  )
  return {
    messages: messages.rows.map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      seq: Number(row.seq),
    })),
    requests: requests.rows.map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      status: row.status,
      user_message_id: row.user_message_id,
      assistant_message_id: row.assistant_message_id,
      error_code: row.error_code,
    })),
  }
}

test.describe('Mobile A New Chat trace', () => {
  test('first New Chat POST is observed and Chat 1 send persists', async ({ page }) => {
    test.setTimeout(90_000)
    const net = []
    page.on('request', (req) => {
      if (!req.url().includes('/api/conversations')) return
      net.push({
        kind: 'request',
        at: Date.now(),
        method: req.method(),
        path: sanitizePath(req.url()),
      })
    })
    page.on('response', (res) => {
      if (!res.url().includes('/api/conversations')) return
      net.push({
        kind: 'response',
        at: Date.now(),
        method: res.request().method(),
        path: sanitizePath(res.url()),
        status: res.status(),
        conversationHeader: res.headers()['x-parle-conversation-id'] || null,
      })
    })

    await login(page)
    if (!/\/chat/.test(page.url())) await page.goto('/chat')
    const skip = page.getByRole('button', { name: /skip onboarding|^skip$|got it/i }).first()
    if (await skip.isVisible().catch(() => false)) await skip.click()

    const openSidebar = page.getByRole('button', { name: /open sidebar/i })
    const sidebarWasClosed = await openSidebar.isVisible().catch(() => false)
    if (sidebarWasClosed) await openSidebar.click()

    const newChatBtn = page.locator('button.parle-chat-sidebar__new-chat')
    await expect(newChatBtn).toBeVisible({ timeout: 20_000 })
    const clickAt = Date.now()
    const created = page.waitForResponse((res) => {
      if (res.request().method() !== 'POST') return false
      try {
        return new URL(res.url()).pathname.replace(/\/$/, '') === '/api/conversations'
      } catch {
        return false
      }
    }, { timeout: 20_000 })
    await newChatBtn.click()
    let createRes = null
    let createError = null
    try {
      createRes = await created
    } catch (error) {
      createError = error.name || 'create_timeout'
    }
    const createMs = Date.now() - clickAt
    const createdId = createRes ? (await createRes.json().catch(() => ({})))?.conversation?.id : null
    const composerEnabled = await composer(page).isEnabled().catch(() => false)
    const urlAfterCreate = conversationIdFromUrl(page)

    console.log(
      `MOBILE_A_CREATE ${JSON.stringify({
        sidebarWasClosed,
        createMs,
        createStatus: createRes ? createRes.status() : null,
        createdId,
        urlAfterCreate,
        composerEnabled,
        createError,
        nodeEnvHint: process.env.NODE_ENV || null,
      })}`,
    )

    expect(createError, 'first New Chat POST /api/conversations must complete').toBeNull()
    expect(createRes.ok()).toBe(true)
    expect(createdId).toMatch(/^[0-9a-f-]{36}$/i)
    await expect(composer(page)).toBeEnabled({ timeout: 20_000 })

    const marker = `v2c1-a-start-${Date.now()}`
    const posted = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/api\/conversations\/[0-9a-f-]{36}\/messages/i.test(res.url()),
      { timeout: 20_000 },
    )
    await composer(page).fill(`synthetic first conversation ${marker}`)
    await expect(sendButton(page)).toBeEnabled()
    await sendButton(page).click()
    const postRes = await posted
    const postId = conversationIdFromMessagesUrl(postRes.url())
    const headerId = postRes.headers()['x-parle-conversation-id'] || null
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })

    const dbState = await inspectConversation(createdId)
    console.log(
      `MOBILE_A_SEND ${JSON.stringify({
        postStatus: postRes.status(),
        postId,
        headerId,
        url: conversationIdFromUrl(page),
        composerEnabledAfter: await composer(page).isEnabled().catch(() => false),
        db: dbState,
        net: net.map((row) => ({
          kind: row.kind,
          method: row.method,
          path: row.path,
          status: row.status || null,
        })),
      })}`,
    )

    expect(postId).toBe(createdId)
    expect(headerId || postId).toBe(createdId)
    expect(conversationIdFromUrl(page)).toBe(createdId)
    expect(dbState.messages.some((row) => row.role === 'user')).toBe(true)
  })
})
