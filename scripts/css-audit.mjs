#!/usr/bin/env node
/**
 * css-audit.mjs — Phase 8b of MIGRATION-PLAN.md §13.8.
 *
 * Diff `getComputedStyle()` between two URLs (typically the Angular and Vue
 * grids rendering the same fixture). Catches CSS regressions during the
 * port — the kind that visual screenshots would also catch but with much
 * more friction (one diff in computed colour shows up here as one row,
 * vs. a 1px shift in a screenshot).
 *
 * Usage:
 *   node scripts/css-audit.mjs \
 *     --base http://localhost:4200/grid-fixture \
 *     --target http://localhost:5173/grid-fixture \
 *     --selector ".grid-cell" \
 *     --properties background,color,border-right,padding,font-size,line-height
 *
 * Exit codes:
 *   0  — no diff (or all diffs whitelisted)
 *   1  — diffs found
 *   2  — usage / fetch error
 *
 * Implementation: spins up two headless Chromium contexts via Playwright,
 * walks every element matching `--selector` in both pages, reads
 * `getComputedStyle()` for each `--property`, and reports rows that differ.
 *
 * Whitelist properties that are intentionally different by passing
 * `--ignore property1,property2`.
 */

import { chromium } from 'playwright'

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    base: null,
    target: null,
    selector: null,
    properties: [],
    ignore: [],
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--base') out.base = args[++i]
    else if (a === '--target') out.target = args[++i]
    else if (a === '--selector') out.selector = args[++i]
    else if (a === '--properties') out.properties = (args[++i] || '').split(',').filter(Boolean)
    else if (a === '--ignore') out.ignore = (args[++i] || '').split(',').filter(Boolean)
    else if (a === '--help' || a === '-h') {
      console.log(
        'usage: node scripts/css-audit.mjs --base URL --target URL --selector CSS [--properties a,b,c] [--ignore a,b]',
      )
      process.exit(0)
    }
  }
  return out
}

async function captureStyles(url, selector, properties) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })

  const styles = await page.$$eval(
    selector,
    (els, props) =>
      els.map((el, i) => {
        const cs = getComputedStyle(el)
        const out = { __index: i }
        for (const p of props) out[p] = cs.getPropertyValue(p).trim()
        return out
      }),
    properties,
  )

  await browser.close()
  return styles
}

function diffStyles(base, target, ignore) {
  const ign = new Set(ignore)
  const diffs = []
  const len = Math.max(base.length, target.length)
  for (let i = 0; i < len; i++) {
    const b = base[i]
    const t = target[i]
    if (!b || !t) {
      diffs.push({ index: i, kind: 'count-mismatch', base: !!b, target: !!t })
      continue
    }
    for (const key of Object.keys(b)) {
      if (key === '__index' || ign.has(key)) continue
      if (b[key] !== t[key]) {
        diffs.push({ index: i, property: key, base: b[key], target: t[key] })
      }
    }
  }
  return diffs
}

async function main() {
  const args = parseArgs()
  if (!args.base || !args.target || !args.selector) {
    console.error(
      'Missing required args. Usage: node scripts/css-audit.mjs --base URL --target URL --selector CSS [--properties a,b,c]',
    )
    process.exit(2)
  }
  if (args.properties.length === 0) {
    args.properties = [
      'background-color',
      'color',
      'font-size',
      'font-weight',
      'line-height',
      'padding',
      'border',
      'box-shadow',
    ]
  }

  console.log(`> Capturing base    ${args.base}`)
  const baseStyles = await captureStyles(args.base, args.selector, args.properties)
  console.log(`> Capturing target  ${args.target}`)
  const targetStyles = await captureStyles(args.target, args.selector, args.properties)

  console.log(`Compared ${args.properties.length} properties on ${args.selector}`)
  console.log(`  base   elements: ${baseStyles.length}`)
  console.log(`  target elements: ${targetStyles.length}`)

  const diffs = diffStyles(baseStyles, targetStyles, args.ignore)
  if (diffs.length === 0) {
    console.log('OK no diffs')
    process.exit(0)
  }

  console.error(`FAIL ${diffs.length} diff(s):`)
  for (const d of diffs) {
    if (d.kind === 'count-mismatch') {
      console.error(
        `  [${d.index}] count mismatch -- base=${d.base} target=${d.target}`,
      )
    } else {
      console.error(
        `  [${d.index}] ${d.property}\n    base   = ${d.base}\n    target = ${d.target}`,
      )
    }
  }
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
