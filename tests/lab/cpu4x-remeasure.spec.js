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

test.describe('4x CPU 60-message rematch', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('repeat audit typing measurement at 4x CPU', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'Match audit on a single throttled Chromium session')
    await page.setViewportSize({ width: 390, height: 844 })
    const client = await page.context().newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await page.addInitScript((draft) => {
      sessionStorage.setItem('parle.chat.guestDraft.v1', JSON.stringify(draft))
    }, makeDraft(60))
    await page.goto('/chat')
    const gotIt = page.getByRole('button', { name: /^got it$/i })
    try {
      await gotIt.waitFor({ state: 'visible', timeout: 8_000 })
      await gotIt.click()
    } catch {
      /* already accepted */
    }
    await expect(page.locator('.parle-chat-msg').first()).toBeVisible({ timeout: 15_000 })
    const sample = 'this is a longer thought about how I feel tonight'
    const stats = await page.evaluate(async (text) => {
      const el = [...document.querySelectorAll('textarea')].find(
        (node) => node.offsetParent !== null && !node.disabled,
      )
      if (!el) return { error: 'no textarea' }
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      const times = []
      const start = performance.now()
      for (let i = 0; i < text.length; i += 1) {
        const t0 = performance.now()
        setter.call(el, text.slice(0, i + 1))
        el.dispatchEvent(new Event('input', { bubbles: true }))
        times.push(performance.now() - t0)
      }
      times.sort((a, b) => a - b)
      return {
        chars: text.length,
        totalMs: +(performance.now() - start).toFixed(1),
        avgMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
        p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2),
        maxMs: +times[Math.max(0, times.length - 1)].toFixed(2),
        nodes: document.querySelectorAll('*').length,
        buttons: document.querySelectorAll('button').length,
        msgs: document.querySelectorAll('.parle-chat-msg').length,
      }
    }, sample)
    console.log('CPU4X_60', stats)
    expect(stats.error).toBeFalsy()
    expect(stats.chars).toBe(49)
    expect(stats.msgs).toBeGreaterThanOrEqual(60)
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  })
})
