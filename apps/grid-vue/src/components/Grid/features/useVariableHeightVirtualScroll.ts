/**
 * Variable-height virtual scroll engine — Vue port of Angular
 * `auto-size-scroll.strategy.ts` (419 LOC). Mirrors its algorithm:
 *
 * 1. **Estimated initial layout**: items get `defaultItemHeight` until
 *    measured. `_offsets[i]` is the cumulative pixel offset of item `i`.
 * 2. **Measurement loop**: a single `ResizeObserver` watches every rendered
 *    DOM node. On measured-height delta, `_heightMap[i]` is updated, the
 *    offset table is rebuilt from `i` onward, and `scrollTop` is adjusted
 *    to keep visible content stable when the delta lands above the
 *    viewport.
 * 3. **rAF debounce**: resize callbacks accumulate inside a single rAF.
 *
 * Use this engine instead of `useVerticalVirtualScroll` (fixed-height) when
 * row heights are not known ahead of time (expandable detail rows, group
 * rows with rich content, wrapped cells).
 *
 * Edge-case watchlist (carry over from the Angular spec coverage):
 * - First mount: don't trust measurements until `_stable === true`.
 * - Item count shrinks: drop entries from `_heightMap` and rebuild offsets.
 * - Scroll past total height when content shrinks: clamp to last item.
 */

import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'

export interface VariableHeightOptions {
  /** Total number of items in the dataset (drives spacer height). */
  itemCount: Ref<number>
  /** Default per-item height in px before measurement. */
  defaultItemHeight: number
  /** Buffer added below the visible window (more = smoother scroll). */
  minBufferPx?: number
  /** Maximum buffer above + below the visible window. */
  maxBufferPx?: number
}

export interface VariableHeightVirtualScroll {
  /** First and last (exclusive) rendered item indices. */
  visibleRange: ComputedRef<{ start: number; end: number }>
  /** Sum of all item heights (drives the scrollbar). */
  totalHeight: ComputedRef<number>
  /** Offset to translate the rendered slice — header-aware spacer height. */
  topSpacer: ComputedRef<number>
  /** Bottom spacer (totalHeight − offset of `end` item). */
  bottomSpacer: ComputedRef<number>
  /** Attach to the scroll viewport. Re-call when the element changes. */
  attach(viewport: HTMLElement): void
  /** Tell the engine to start observing a rendered child. */
  observe(el: Element, index: number): void
  /** Stop observing a rendered child (called when it unmounts). */
  unobserve(el: Element): void
  /** Imperative scroll to an absolute item index. */
  scrollToIndex(index: number): void
  /**
   * Pre-seed the height of an item that is about to expand (e.g. detail row
   * opening). Call this BEFORE the row renders so the virtual layout
   * immediately allocates `defaultHeight` pixels of space, preventing a
   * scroll-jump when the ResizeObserver fires for the first time.
   *
   * If the index is already measured (present in the height map), the call
   * is a no-op — the ResizeObserver measurement takes precedence.
   *
   * @param absoluteIndex  0-based row index in the full dataset.
   * @param defaultHeight  Estimated initial height in px (default 200).
   */
  primeExpanded(absoluteIndex: number, defaultHeight?: number): void
}

const DEFAULT_MIN_BUFFER = 200
const DEFAULT_MAX_BUFFER = 400

export function useVariableHeightVirtualScroll(
  opts: VariableHeightOptions,
): VariableHeightVirtualScroll {
  const minBuffer = opts.minBufferPx ?? DEFAULT_MIN_BUFFER
  const maxBuffer = opts.maxBufferPx ?? DEFAULT_MAX_BUFFER

  // --- Reactive layout state ---
  const scrollTop = ref(0)
  const viewportHeight = ref(0)

  // --- Imperative measurement state (non-reactive — touched in rAF) ---
  // `heightMap` is stored in a `ref` wrapping a Map so that `visibleRange` and
  // `totalHeight` automatically re-run when a measurement pass completes.
  // After each measurement we do `heightMap.value = new Map(heightMap.value)`
  // which replaces the reference, triggering Vue's reactivity tracking without
  // allocating a full reactive proxy for every Map entry (performance-neutral).
  //
  // If this replacement strategy causes performance issues with very large
  // datasets (>10k items with frequent ResizeObserver callbacks), the previous
  // `measureBump: Ref<number>` counter approach can be restored:
  //   const measureBump = ref(0)  // increment instead of replacing the Map
  //   void measureBump.value  // touch in visibleRange / totalHeight computeds
  const heightMap = ref(new Map<number, number>())
  let offsets: number[] = []
  let resizeObserver: ResizeObserver | null = null
  const observed = new Map<Element, number>()
  let rafId: number | null = null
  let viewport: HTMLElement | null = null
  let stable = false

  function rebuildOffsets(fromIndex = 0): void {
    const n = opts.itemCount.value
    const hm = heightMap.value
    if (offsets.length !== n + 1) {
      offsets = new Array(n + 1)
      offsets[0] = 0
      for (let i = 1; i <= n; i++) {
        offsets[i] = offsets[i - 1]! + (hm.get(i - 1) ?? opts.defaultItemHeight)
      }
      return
    }
    for (let i = fromIndex + 1; i <= n; i++) {
      offsets[i] = offsets[i - 1]! + (hm.get(i - 1) ?? opts.defaultItemHeight)
    }
  }

  function findIndexAtOffset(targetY: number): number {
    // Binary search on offsets — O(log n).
    let lo = 0
    let hi = offsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid + 1]! <= targetY) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const visibleRange = computed<{ start: number; end: number }>(() => {
    // Touch reactive deps so the computed re-runs on layout / count / measure.
    // Reading `heightMap.value` (the Ref<Map>) establishes a reactive dependency —
    // when the measurement pass replaces the Map reference, this computed re-runs.
    const n = opts.itemCount.value
    void heightMap.value // reactive dep — do not remove
    if (n === 0) return { start: 0, end: 0 }
    if (offsets.length !== n + 1) rebuildOffsets()

    const startY = Math.max(0, scrollTop.value - maxBuffer)
    const endY = scrollTop.value + viewportHeight.value + maxBuffer
    const start = Math.max(0, findIndexAtOffset(startY))
    let end = Math.min(n, findIndexAtOffset(endY) + 1)
    if (end - start < 1) end = Math.min(n, start + 1)
    return { start, end }
  })

  const totalHeight = computed<number>(() => {
    void heightMap.value // reactive dep — do not remove
    const n = opts.itemCount.value
    if (offsets.length !== n + 1) rebuildOffsets()
    return offsets[n] ?? 0
  })

  const topSpacer = computed<number>(() => {
    const start = visibleRange.value.start
    if (offsets.length === 0) return 0
    return offsets[start] ?? 0
  })

  const bottomSpacer = computed<number>(() => {
    const end = visibleRange.value.end
    return Math.max(0, totalHeight.value - (offsets[end] ?? 0))
  })

  function onScroll(): void {
    if (!viewport) return
    scrollTop.value = viewport.scrollTop
  }

  function measure(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      let minChangedIndex = Infinity
      let aboveScroll = 0
      const st = viewport ? viewport.scrollTop : scrollTop.value
      const hm = heightMap.value

      for (const [el, index] of observed) {
        const measured = (el as HTMLElement).offsetHeight
        const previous = hm.get(index) ?? opts.defaultItemHeight
        if (measured !== previous && measured > 0) {
          hm.set(index, measured)
          if (index < minChangedIndex) minChangedIndex = index
          // If the changed item is above the current viewport, the scroll
          // needs to compensate so visible rows don't jump.
          const itemOffset = offsets[index] ?? 0
          if (itemOffset < st) aboveScroll += measured - previous
        }
      }

      if (Number.isFinite(minChangedIndex)) {
        rebuildOffsets(minChangedIndex)
        if (aboveScroll !== 0 && viewport) {
          // Adjust scrollTop atomically to avoid a visual jump.
          viewport.scrollTop = st + aboveScroll
          scrollTop.value = viewport.scrollTop
        }
        // Replace the Map reference to trigger reactive computeds that depend
        // on heightMap.value. This is cheaper than a separate `measureBump`
        // counter because it only allocates once per rAF batch regardless of
        // how many items were remeasured.
        heightMap.value = new Map(hm)
        stable = true
      }
    })
  }

  function attach(el: HTMLElement): void {
    detach()
    viewport = el
    viewportHeight.value = el.clientHeight
    scrollTop.value = el.scrollTop
    el.addEventListener('scroll', onScroll, { passive: true })

    resizeObserver = new ResizeObserver(() => measure())

    // Watch the viewport height (window resize, drawer toggle, etc.).
    const heightObserver = new ResizeObserver(() => {
      viewportHeight.value = el.clientHeight
    })
    heightObserver.observe(el)

    rebuildOffsets()
    // Trigger reactive dependents after the initial offset build.
    heightMap.value = new Map(heightMap.value)
  }

  function observe(el: Element, index: number): void {
    if (!resizeObserver) return
    observed.set(el, index)
    resizeObserver.observe(el)
    // Initial measurement happens on next rAF tick.
    measure()
  }

  function unobserve(el: Element): void {
    if (!resizeObserver) return
    resizeObserver.unobserve(el)
    observed.delete(el)
  }

  function scrollToIndex(index: number): void {
    if (!viewport) return
    if (offsets.length === 0) rebuildOffsets()
    const target = offsets[Math.max(0, Math.min(index, opts.itemCount.value))] ?? 0
    viewport.scrollTop = target
  }

  function primeExpanded(absoluteIndex: number, defaultHeight = 200): void {
    const hm = heightMap.value
    // No-op if already measured — the ResizeObserver measurement is authoritative.
    if (hm.has(absoluteIndex)) return
    const next = new Map(hm)
    next.set(absoluteIndex, defaultHeight)
    // Rebuild offsets from the primed index before replacing the reactive ref so
    // the offset table is consistent when visibleRange and totalHeight re-run.
    heightMap.value = next
    rebuildOffsets(absoluteIndex)
    // Replace the ref a second time to ensure Vue's dependency tracker sees the
    // latest Map instance (rebuildOffsets mutates the internal `offsets` array,
    // not the Map itself — the replace is the reactivity trigger).
    heightMap.value = new Map(next)
  }

  function detach(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (viewport) {
      viewport.removeEventListener('scroll', onScroll)
      viewport = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    observed.clear()
    stable = false
  }

  onScopeDispose(detach)

  return {
    visibleRange,
    totalHeight,
    topSpacer,
    bottomSpacer,
    attach,
    observe,
    unobserve,
    scrollToIndex,
    primeExpanded,
  }
}
