<script setup lang="ts">
/**
 * App shell — Sprint 9 (cleanup).
 *
 * Two render modes:
 *   • `?fixtures=<state>` in the URL → render the visual-regression
 *     fixture harness used by `e2e/visual.spec.ts`.
 *   • Anything else → render the Stock demo directly.
 *
 * The earlier "stress test" demo (100k × 150 grid) and the demo-mode toggle
 * have been removed at the user's request — Stock demo is the canonical
 * showcase now. Restore via Git history if perf benchmarks are needed.
 */

import GridFixtures from '@/views/GridFixtures.vue'
import StockDemo from '@/views/StockDemo.vue'

const isFixtureMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('fixtures')
</script>

<template>
  <GridFixtures v-if="isFixtureMode" />
  <StockDemo v-else />
</template>
