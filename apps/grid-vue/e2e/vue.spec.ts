import { test, expect } from '@playwright/test'

test('visits the app root url and renders the stock demo', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('AdeoGrid · Stock demo')
})
