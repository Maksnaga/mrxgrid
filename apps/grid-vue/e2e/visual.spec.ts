/**
 * Visual regression suite — Phase 8b of MIGRATION-PLAN.md §13.8.
 *
 * Captures screenshots of the grid in each of the 30+ documented visual
 * states and asserts pixel parity against a baseline. Run locally with:
 *
 *   npm run test:e2e -- e2e/visual.spec.ts --project=chromium
 *
 * On the first run, baselines are created in `e2e/visual.spec.ts-snapshots/`.
 * On subsequent runs, the test fails if rendered output diverges by more
 * than the configured `maxDiffPixelRatio`. Update baselines with
 * `--update-snapshots`.
 *
 * Fixtures are served by `src/views/GridFixtures.vue` — navigate to
 * `/?fixtures=<state>` to render the grid in a specific configuration.
 * To add a new state: append it to `FIXTURES` in `GridFixtures.vue` plus
 * a test below. Keep row data tiny (≤ 5 rows) for deterministic snapshots.
 */

import { expect, test, type Page } from '@playwright/test'

const TOLERANCE = { maxDiffPixelRatio: 0.005 } // 0.5% — kills false positives from font hinting

/** Helper: navigate to a fixture state and wait for it to mount. */
async function gotoFixture(page: Page, state: string): Promise<void> {
  await page.goto(`/?fixtures=${state}`)
  await page.locator(`[data-fixture="${state}"]`).waitFor({ state: 'visible' })
  await page.locator('.grid-root').first().waitFor({ state: 'visible' })
}

// ---------------------------------------------------------------------------
// Cell state matrix — one screenshot per state.
// Each test navigates to a fixture page, brings the grid into the state,
// and snapshots the cell of interest.
// ---------------------------------------------------------------------------

test.describe('Cell visual states', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, 'default')
  })

  test('default cell', async ({ page }) => {
    await expect(page.locator('.grid-cell').first()).toHaveScreenshot(
      'cell-default.png',
      TOLERANCE,
    )
  })

  test('hover state', async ({ page }) => {
    const cell = page.locator('.grid-cell').first()
    await cell.hover()
    await expect(cell).toHaveScreenshot('cell-hover.png', TOLERANCE)
  })

  test('focused (active) cell', async ({ page }) => {
    const cell = page.locator('.grid-cell').first()
    await cell.click()
    await expect(cell).toHaveScreenshot('cell-focused.png', TOLERANCE)
  })

  test('cell in range (Shift+click)', async ({ page }) => {
    const first = page.locator('.grid-cell').nth(0)
    const last = page.locator('.grid-cell').nth(4)
    await first.click()
    await last.click({ modifiers: ['Shift'] })
    await expect(page.locator('.grid-row').first()).toHaveScreenshot(
      'cell-in-range.png',
      TOLERANCE,
    )
  })

  test('cut source (marching ants)', async ({ page }) => {
    await page.locator('.grid-cell').first().click()
    await page.keyboard.press('Control+x')
    // Wait one animation frame so the marching-ants kicks in.
    await page.waitForTimeout(100)
    await expect(page.locator('.grid-row').first()).toHaveScreenshot(
      'cell-cut-source.png',
      TOLERANCE,
    )
  })

  test('validation error (invalid email cell)', async ({ page }) => {
    // Charlie row has an invalid email; the cellValidator paints a red border
    // and a danger icon at the cell's right edge.
    const invalidCell = page.locator('.grid-cell--invalid').first()
    await invalidCell.waitFor({ state: 'visible' })
    await expect(invalidCell).toHaveScreenshot('cell-validation-error.png', TOLERANCE)
  })

  test('pinned-right column (status)', async ({ page }) => {
    // The `status` column is pinned-right in the default fixture.
    await expect(page.locator('.grid-row').first()).toHaveScreenshot(
      'pinned-right-column.png',
      TOLERANCE,
    )
  })

  test('fill range (drag fill handle)', async () => {
    test.skip(true, 'TODO: cell-selection drag-fill needs a richer fixture')
  })

  test('formula error (#PARSE!)', async () => {
    test.skip(true, 'TODO: add allowFormula fixture with a bad formula')
  })

  test('readonly cell', async () => {
    test.skip(true, 'TODO: fixture for editable=false cell')
  })

  test('ref-highlight (formula edit referencing cell)', async () => {
    test.skip(true, 'TODO: allowFormula fixture + start edit referencing first cell')
  })
})

// ---------------------------------------------------------------------------
// Row visual states
// ---------------------------------------------------------------------------

test.describe('Row visual states', () => {
  test('selected row (Gmail-style checkbox)', async ({ page }) => {
    await gotoFixture(page, 'selectable')
    // First data row checkbox lives in the second `.grid-checkbox-cell`
    // (header owns the first). We click the inner `.mc-checkbox` because
    // Mozaic's `MCheckbox` listens on the input child, not the wrapper.
    await page.locator('.grid-checkbox-cell .mc-checkbox').nth(1).click()
    await expect(page.locator('.grid-row').nth(1)).toHaveScreenshot(
      'row-selected.png',
      TOLERANCE,
    )
  })

  test('expandable row (button visible)', async ({ page }) => {
    await gotoFixture(page, 'expandable')
    await expect(page.locator('.grid-row').nth(1)).toHaveScreenshot(
      'row-expandable.png',
      TOLERANCE,
    )
  })

  test('expanded row (detail-row open)', async () => {
    test.skip(true, 'TODO: needs #expand-row slot configured in fixture')
  })

  test('group header row', async () => {
    test.skip(true, 'TODO: fixture with `groupFields` enabled')
  })
})

// ---------------------------------------------------------------------------
// Drawer / overlay visual states
// ---------------------------------------------------------------------------

test.describe('Overlay visual states', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, 'default')
  })

  test('column-visibility-panel (3 hidden columns)', async ({ page }) => {
    test.skip(true, 'TODO: hide 3 columns then snapshot the panel')
  })

  test('selection-bar visible', async ({ page }) => {
    test.skip(true, 'TODO: select a row then snapshot the floating bar')
  })

  test('settings-drawer open', async ({ page }) => {
    test.skip(true, 'TODO: open settings drawer')
  })

  test('group-drawer open', async ({ page }) => {
    test.skip(true, 'TODO: open grouping drawer')
  })

  test('filter-drawer open with 3 conditions', async ({ page }) => {
    test.skip(true, 'TODO: open filter drawer + add 3 conditions')
  })

  test('keyboard-shortcuts-drawer open', async ({ page }) => {
    test.skip(true, 'TODO: open keyboard shortcuts drawer')
  })

  test('formula-reference-drawer open', async ({ page }) => {
    test.skip(true, 'TODO: open formula reference drawer (allowFormula needed)')
  })

  test('header-menu open on a column', async ({ page }) => {
    test.skip(true, 'TODO: click kebab on column header + snapshot menu')
  })
})

// ---------------------------------------------------------------------------
// Layout / pinning visual states
// ---------------------------------------------------------------------------

test.describe('Layout visual states', () => {
  test('density: compact', async ({ page }) => {
    await gotoFixture(page, 'density-compact')
    await expect(page.locator('.grid-root').first()).toHaveScreenshot(
      'density-compact.png',
      TOLERANCE,
    )
  })

  test('density: comfortable', async ({ page }) => {
    await gotoFixture(page, 'density-comfortable')
    await expect(page.locator('.grid-root').first()).toHaveScreenshot(
      'density-comfortable.png',
      TOLERANCE,
    )
  })

  test('empty state (no rows)', async ({ page }) => {
    await gotoFixture(page, 'empty')
    await expect(page.locator('.fixtures-root').first()).toHaveScreenshot(
      'state-empty.png',
      TOLERANCE,
    )
  })

  test('loading overlay', async ({ page }) => {
    await gotoFixture(page, 'loading')
    await expect(page.locator('.fixtures-root').first()).toHaveScreenshot(
      'state-loading.png',
      TOLERANCE,
    )
  })

  test('error overlay', async ({ page }) => {
    await gotoFixture(page, 'error')
    await expect(page.locator('.fixtures-root').first()).toHaveScreenshot(
      'state-error.png',
      TOLERANCE,
    )
  })

  test('virtual scroll mid-page (10k rows)', async () => {
    test.skip(true, 'TODO: fixture with 10k rows + programmatic scroll-to-row')
  })

  test('grouping with 3 levels', async () => {
    test.skip(true, 'TODO: fixture with 3-level grouping enabled')
  })
})
