const { test, expect } = require('@playwright/test')

async function acceptGuestTerms(page) {
  const gotIt = page.getByRole('button', { name: /^got it$/i })
  try {
    await gotIt.waitFor({ state: 'visible', timeout: 8_000 })
    await gotIt.click()
  } catch {
    /* already accepted in this context */
  }
}

function composer(page) {
  return page.getByPlaceholder(/say what's on your mind/i).filter({ visible: true }).first()
}

test.describe('First-message onboarding', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('normal first reply streams without answering onboarding', async ({ page }) => {
    await page.goto('/chat')
    await acceptGuestTerms(page)
    const input = composer(page)
    await expect(input).toBeVisible()
    await input.fill('hi, this is a synthetic check-in about waiting in the rain')
    await page.getByRole('button', { name: /^send$/i }).click()

    const assistant = page.locator('.parle-chat-msg--assistant:not(.parle-chat-msg--typing)').last()
    await expect(assistant).toBeVisible({ timeout: 45_000 })
    await expect(assistant).not.toHaveText(/^\s*$/)

    const sheet = page.getByRole('dialog', { name: /quick question so i can show up better/i })
    if (await sheet.isVisible().catch(() => false)) {
      await expect(composer(page)).toBeEnabled()
    }
  })

  test('crisis hotlines show without requiring an onboarding choice', async ({ page }) => {
    await page.goto('/chat')
    await acceptGuestTerms(page)
    const input = composer(page)
    await expect(input).toBeVisible()
    await input.fill("i don't want to be here anymore")
    await page.getByRole('button', { name: /^send$/i }).click()
    await expect(page.getByText(/1-767/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/6389 2222/)).toBeVisible()
    await expect(composer(page)).toBeEnabled()
  })
})
