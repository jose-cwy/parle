const { test, expect } = require('@playwright/test')

function makeDraft(count) {
  const messages = []
  for (let i = 0; i < count; i += 1) {
    const role = i % 2 === 0 ? 'user' : 'assistant'
    messages.push({
      id: `perf-${i}`,
      role,
      text: `${role === 'user' ? 'I keep thinking about them. ' : 'I hear how heavy that feels. '}Synthetic ${i}.`,
      at: Date.now() - (count - i) * 60_000,
    })
  }
  return {
    messages,
    chatModeId: 'cross',
    pendingModeId: 'cross',
    savedAt: Date.now(),
  }
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

async function loadSyntheticChat(page, count) {
  await page.addInitScript((draft) => {
    sessionStorage.setItem('parle.chat.guestDraft.v1', JSON.stringify(draft))
  }, makeDraft(count))
  await page.goto('/chat')
  await acceptGuestTerms(page)
  await expect(page.locator('.parle-chat-msg').first()).toBeVisible({ timeout: 15_000 })
}

async function measureTyping(page, chars = 'this is a longer thought about how I feel tonight') {
  return page.evaluate(async (sample) => {
    const el = [...document.querySelectorAll('textarea')].find(
      (node) => node.offsetParent !== null && !node.disabled,
    )
    if (!el) return { error: 'no textarea' }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    const times = []
    const start = performance.now()
    for (let i = 0; i < sample.length; i += 1) {
      const t0 = performance.now()
      setter.call(el, sample.slice(0, i + 1))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    return {
      chars: sample.length,
      totalMs: +(performance.now() - start).toFixed(1),
      avgMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
      p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2),
      maxMs: +Math.max(...times).toFixed(2),
      nodes: document.querySelectorAll('*').length,
      buttons: document.querySelectorAll('button').length,
      msgs: document.querySelectorAll('.parle-chat-msg').length,
    }
  }, chars)
}

test.describe('Chat composer performance', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const count of [5, 20, 60, 100]) {
    test(`typing stays local with ${count} messages`, async ({ page }) => {
      await loadSyntheticChat(page, count)
      const stats = await measureTyping(page)
      expect(stats.error).toBeFalsy()
      expect(stats.msgs).toBeGreaterThanOrEqual(count)
      expect(stats.avgMs).toBeLessThan(20)
      expect(stats.p95Ms).toBeLessThan(40)
      console.log(`PERF ${count}`, stats)
    })
  }

  test('scrolling up is not forced back down on a later layout', async ({ page }) => {
    await loadSyntheticChat(page, 60)
    const before = await page.evaluate(() => {
      const el = document.querySelector('.parle-chat-main__scroll')
      el.scrollTop = 40
      return el.scrollTop
    })
    await page.waitForTimeout(250)
    const after = await page.evaluate(() => document.querySelector('.parle-chat-main__scroll').scrollTop)
    expect(after).toBeLessThanOrEqual(before + 8)
  })
})
