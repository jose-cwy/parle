const { test, expect } = require('@playwright/test')

test.describe('Landing page', () => {
  test('navbar wordmark and hero CTA route to chat', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /^parlé$/i }).first()).toBeVisible()
    const startTalking = page.getByRole('link', { name: /just start talking|start talking/i }).first()
    await expect(startTalking).toBeVisible()
    await startTalking.click()
    await expect(page).toHaveURL(/\/chat/)
  })

  test('marketing nav drawer opens and closes', async ({ page }) => {
    await page.goto('/')
    const menuButton = page.getByRole('button', { name: /open menu|menu/i }).first()
    await menuButton.click()
    await expect(page.getByRole('dialog', { name: /navigation menu/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /start talking|talk it through/i }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /navigation menu/i })).toBeHidden()
  })

  test('footer links route to terms and contact', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /terms & safety|terms/i }).first().click()
    await expect(page).toHaveURL(/\/terms/)
    await page.goto('/')
    await page.getByRole('link', { name: /contact/i }).first().click()
    await expect(page).toHaveURL(/\/contact/)
  })
})

test.describe('Auth redirects', () => {
  test('guest journal access redirects to login', async ({ page }) => {
    await page.goto('/journal')
    await expect(page).toHaveURL(/\/login/)
  })

  test('guest quotes access redirects to login', async ({ page }) => {
    await page.goto('/quotes')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Guest chat crisis detection', () => {
  test('crisis message returns Singapore hotlines', async ({ page }) => {
    await page.goto('/chat')
    const input = page.locator('textarea').first()
    await expect(input).toBeVisible()
    await input.fill("i don't want to be here anymore")
    await page.getByRole('button', { name: /^send$/i }).click()
    await expect(page.getByText(/1-767/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/6389 2222/)).toBeVisible()
    await expect(page.getByText(/chat\.mentalhealth\.sg/)).toBeVisible()
  })
})
