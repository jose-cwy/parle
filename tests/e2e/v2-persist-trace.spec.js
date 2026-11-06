const { test, expect } = require('@playwright/test')

const EMAIL = process.env.TEST_PARLE_EMAIL_PERSIST || 'testuser_persist@parle.test'
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

async function login(page) {
  const token = process.env.TEST_PARLE_SESSION_PERSIST
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3076'
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

async function inspectConversation(id) {
  const db = require('../../lib/db')
  const messages = await db.query(
    `SELECT id, conversation_id, role, seq
     FROM conversation_messages
     WHERE conversation_id = $1
     ORDER BY seq`,
    [id],
  )
  const requests = await db.query(
    `SELECT id, conversation_id, status, user_message_id, assistant_message_id, error_code, lease_owner
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
      lease_owner: row.lease_owner ? 'set' : null,
    })),
  }
}

test.describe('V2 Chat 2 persist trace', () => {
  test('Chat 2 POST UUID matches created UUID, GET, and transcript', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await setStub(page, 'ok')

    const create1 = await newChat(page)
    const chat1Id = (await create1.json())?.conversation?.id
    expect(chat1Id).toMatch(/^[0-9a-f-]{36}$/i)
    const marker1 = `persist-c1-${Date.now()}`
    const post1 = await sendTurn(page, `synthetic chat one ${marker1}`)
    expect(conversationIdFromMessagesUrl(post1.url())).toBe(chat1Id)
    await expect(page.getByText(marker1)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })

    const urlBeforeNewChat = conversationIdFromUrl(page)
    const create2Started = Date.now()
    const create2 = await newChat(page)
    const create2Ms = Date.now() - create2Started
    const chat2Id = (await create2.json())?.conversation?.id
    expect(chat2Id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(chat2Id).not.toBe(chat1Id)
    expect(urlBeforeNewChat === chat1Id || urlBeforeNewChat === chat2Id).toBeTruthy()

    const marker2 = `persist-c2-${Date.now()}`
    const post2 = await sendTurn(page, `synthetic chat two ${marker2}`)
    const post2Id = conversationIdFromMessagesUrl(post2.url())
    const header2 = post2.headers()['x-parle-conversation-id']
    const urlAtSend = conversationIdFromUrl(page)
    await expect(page.getByText(marker2)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(marker1)).toHaveCount(0)
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })

    const getStarted = Date.now()
    const getRes = await page.request.get(`/api/conversations/${chat2Id}`)
    const getMs = Date.now() - getStarted
    expect(getRes.ok()).toBe(true)
    const getBody = await getRes.json()
    const getMessageIds = (getBody.messages || []).map((row) => row.id)
    const dbState = await inspectConversation(chat2Id)
    const chat1State = await inspectConversation(chat1Id)

    const trace = {
      selectedBeforeNewChat: urlBeforeNewChat,
      create2Id: chat2Id,
      create2Ms,
      urlWhenSendObserved: urlAtSend,
      post2Id,
      header2: header2 || null,
      post2Status: post2.status(),
      get2Ok: getRes.ok(),
      getMs,
      getMessageCount: getMessageIds.length,
      dbChat2User: dbState.messages.filter((row) => row.role === 'user').map((row) => row.id),
      dbChat2Assistant: dbState.messages.filter((row) => row.role === 'assistant').map((row) => row.id),
      dbChat2Requests: dbState.requests,
      chat1UserCount: chat1State.messages.filter((row) => row.role === 'user').length,
    }
    console.log(`PERSIST_TRACE ${JSON.stringify(trace)}`)

    expect(post2Id, 'Chat 2 must POST to the New Chat UUID').toBe(chat2Id)
    expect(header2 || post2Id).toBe(chat2Id)
    expect(conversationIdFromUrl(page)).toBe(chat2Id)
    expect(
      (getBody.messages || []).some((row) => String(row.text || '').includes(marker2)),
      'GET Chat 2 must include the accepted user marker',
    ).toBe(true)
    expect(chat1State.messages.some((row) => row.conversation_id === chat1Id)).toBe(true)
    expect(
      chat1State.messages.length === 0 ||
        !(await page.request.get(`/api/conversations/${chat1Id}`).then((res) => res.json()))
          .messages.some((row) => String(row.text || '').includes(marker2)),
    ).toBe(true)
    await composer(page).fill('composer after persist trace')
    await expect(sendButton(page)).toBeEnabled()
  })

  test('refresh during drip keeps the committed Chat 2 user message', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await openChat(page)
    await setStub(page, 'ok')
    const create1 = await newChat(page)
    const chat1Id = (await create1.json())?.conversation?.id
    await sendTurn(page, `synthetic prior ${Date.now()}`)
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 20_000 })

    await setStub(page, 'drip')
    const create2 = await newChat(page)
    const chat2Id = (await create2.json())?.conversation?.id
    expect(chat2Id).not.toBe(chat1Id)
    const marker = `persist-drip-${Date.now()}`
    const posted = await sendTurn(page, `refresh mid stream ${marker}`)
    expect(posted.ok()).toBe(true)
    const postId = conversationIdFromMessagesUrl(posted.url())
    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.parle-chat-msg--assistant').last()).toBeVisible({ timeout: 10_000 })
    expect(postId).toBe(chat2Id)
    expect(conversationIdFromUrl(page)).toBe(chat2Id)

    const before = await inspectConversation(chat2Id)
    console.log(`REFRESH_TRACE_BEFORE ${JSON.stringify({ postId, url: conversationIdFromUrl(page), before })}`)

    await page.reload()
    await openChat(page)
    await expect(page).toHaveURL(new RegExp(`[?&]c=${chat2Id}`))
    const afterGet = await page.request.get(`/api/conversations/${chat2Id}`)
    const afterBody = await afterGet.json()
    const after = await inspectConversation(chat2Id)
    console.log(
      `REFRESH_TRACE_AFTER ${JSON.stringify({
        getOk: afterGet.ok(),
        getCount: (afterBody.messages || []).length,
        after,
      })}`,
    )
    expect(
      (afterBody.messages || []).some((row) => String(row.text || '').includes(marker)),
    ).toBe(true)
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 })
    await composer(page).fill('composer after interrupted refresh')
    await expect(sendButton(page)).toBeEnabled()
  })
})
