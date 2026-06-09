import { ref, nextTick, onBeforeUnmount, isRef, type MaybeRef, type Ref } from 'vue'
import type { ColumnDef } from '@/components/AdeoGrid/types'

const DEFAULT_WIDTH = 150
const DEFAULT_DROP_ANIMATION_MS = 220

function parsePx(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  if (value.endsWith('px')) {
    const n = parseFloat(value)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

function unrefMaybe<T>(v: MaybeRef<T>): T {
  return isRef(v) ? v.value : v
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PinZone = 'left' | 'center' | 'right'

export interface ColumnDnDOptions {
  allColumns: Ref<ColumnDef[]>
  leftColumns: Ref<ColumnDef[]>
  centerColumns: Ref<ColumnDef[]>
  rightColumns: Ref<ColumnDef[]>
  getColumnWidth: (field: string) => string | undefined
  wrapperRef: Ref<HTMLElement | null>
  utilityWidth: MaybeRef<number>
  /** Commit a single reorder — fired ONCE on `mouseup` at the final
   *  drop position. `beforeField` is the field in front of which to
   *  insert (null = end of the global order). */
  onReorder: (field: string, beforeField: string | null) => void
  /** Cross-zone pinning — fired on `mouseup` when the drop lands in a
   *  different zone (center → pinned start/end). Pass `null` to unpin.
   *  Always called BEFORE `onReorder` so the column joins the new
   *  zone at the right slot. */
  onPin: (field: string, pinned: 'left' | 'right' | null) => void
  /** Reactive ref the composable mutates with the field name of the
   *  column currently being dragged (or `null`). Cells subscribe to
   *  this through the slot context to apply the dim class. */
  movingField: Ref<string | null>
  /** Duration of the drop-time slide animation, in ms. The FLIP runs
   *  ONCE, on `mouseup`, when the column commits to its new slot —
   *  not during the drag itself, so there's no animation chaining. */
  dropAnimationMs?: number
}

// ---------------------------------------------------------------------------
// Composable — column move (drop-only commit, AG-Grid-style preview)
// ---------------------------------------------------------------------------

/**
 * Drag-to-reorder columns, AG-Grid-flavoured.
 *
 * The implementation deliberately keeps the data layout STABLE during the
 * gesture and only commits the reorder on `mouseup`. Live mid-drag commits
 * (the previous approach) cascaded a full Vue re-render through the
 * virtualised body, the FLIP slide, and the moving-cell class repaint —
 * with a few hundred mutations per cursor pixel that surfaced as visible
 * flickering on every drag.
 *
 * What the user sees during the gesture:
 *   - the source column dimmed in place (driven by the reactive
 *     `movingField` flag the cells subscribe to)
 *   - a thin vertical insert-line at the slot the column would occupy
 *     if released right now
 *   - a floating ghost following the cursor with the column's headerName
 *
 * On `mouseup`:
 *   - the final drop slot's `(beforeField, pin)` is committed in a single
 *     `onPin` + `onReorder` round-trip
 *   - if the drop slot equals the source slot, nothing is committed
 *
 * `Escape` aborts the gesture without committing — same path as a drop
 * outside the wrapper.
 */
export function useColumnDnD(options: ColumnDnDOptions) {
  const {
    allColumns,
    leftColumns,
    centerColumns,
    rightColumns,
    getColumnWidth,
    wrapperRef,
    onReorder,
    onPin,
  } = options

  const isDragging = ref(false)
  const movingField = options.movingField

  // --- Drag state (non-reactive) ---
  let _field = ''
  let _headerName = ''
  let _colWidth = 0
  let _sourceZone: PinZone = 'center'
  let _mouseX = 0
  let _mouseY = 0
  let _startX = 0
  let _startY = 0
  let _dragActivated = false

  const DRAG_THRESHOLD = 5

  // --- Ghost element (single, reused) ---
  let _ghostEl: HTMLElement | null = null

  function ensureGhostEl(): HTMLElement {
    if (!_ghostEl) {
      const el = document.createElement('div')
      el.className = 'adeo-grid-column-drag-ghost'
      Object.assign(el.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '10000',
        padding: '6px 12px',
        background: 'var(--color-background-primary, #fff)',
        border: '2px solid var(--color-text-accent, #2563eb)',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--color-text-primary, #1e293b)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: '0.95',
        display: 'none',
      })
      document.body.appendChild(el)
      _ghostEl = el
    }
    return _ghostEl
  }

  function hideGhost() {
    if (_ghostEl) _ghostEl.style.display = 'none'
  }

  function destroyGhost() {
    _ghostEl?.remove()
    _ghostEl = null
  }

  function updateGhost() {
    const ghost = ensureGhostEl()
    ghost.style.left = `${_mouseX + 12}px`
    ghost.style.top = `${_mouseY - 14}px`
  }

  // --- Insert-line indicator (cross-zone only) ---
  // Same-zone moves use live cell transforms (the dragged column visibly
  // slides under the cursor while neighbours animate aside), so an
  // indicator there would be redundant. Cross-zone (center → pinned)
  // skips live transforms because the math becomes tangled across two
  // layout origins — but without ANY visual cue the user has no idea
  // where the column will land in the destination zone. The line fills
  // that gap: a thin vertical bar positioned at the would-be drop slot.
  let _indicatorEl: HTMLElement | null = null

  function ensureIndicatorEl(): HTMLElement {
    if (!_indicatorEl) {
      const el = document.createElement('div')
      el.className = 'adeo-grid-column-drag-indicator'
      Object.assign(el.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '9999',
        width: '2px',
        background: 'var(--color-text-accent, #2563eb)',
        boxShadow: '0 0 0 1px rgba(37, 99, 235, 0.25)',
        display: 'none',
      })
      document.body.appendChild(el)
      _indicatorEl = el
    }
    return _indicatorEl
  }

  function showIndicator(clientX: number) {
    const wrapper = wrapperRef.value
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    const el = ensureIndicatorEl()
    el.style.left = `${clientX - 1}px`
    el.style.top = `${rect.top}px`
    el.style.height = `${rect.height}px`
    el.style.display = ''
  }

  function hideIndicator() {
    if (_indicatorEl) _indicatorEl.style.display = 'none'
  }

  function destroyIndicator() {
    _indicatorEl?.remove()
    _indicatorEl = null
  }

  // --- Helpers ---

  function resolveWidth(col: ColumnDef): number {
    return parsePx(getColumnWidth(col.field) ?? col.width, DEFAULT_WIDTH)
  }

  /**
   * Field → actual rendered width, measured from the DOM. The last centre
   * column is flex-stretched to fill the viewport, so its real width is far
   * larger than `resolveWidth` reports (that only knows the *defined* width).
   * `translateX` from the live drag transforms does not change an element's
   * width, so this stays correct mid-drag. Columns with no cell in the DOM
   * (virtualised out) are simply absent — callers fall back to resolveWidth.
   */
  function buildRenderedWidths(): Map<string, number> {
    const map = new Map<string, number>()
    const wrapper = wrapperRef.value
    if (!wrapper) return map
    const cells = wrapper.querySelectorAll<HTMLElement>('[data-field]')
    cells.forEach((c) => {
      const f = c.dataset.field
      if (!f || map.has(f)) return
      const w = c.getBoundingClientRect().width
      if (w > 0) map.set(f, w)
    })
    return map
  }

  /**
   * True when horizontal column virtualisation is dropping off-screen
   * columns from the DOM (rendered header cells < total columns). The live
   * per-frame slide needs every column between source and target rendered;
   * when columns are virtualised that's impossible, so the gesture falls
   * back to the insert-line indicator during the drag and a FLIP slide on
   * drop.
   */
  function isColumnVirtualized(): boolean {
    const wrapper = wrapperRef.value
    if (!wrapper) return false
    const rendered = wrapper.querySelectorAll('.adeo-grid-grid-header-cell[data-field]').length
    const total =
      leftColumns.value.length + centerColumns.value.length + rightColumns.value.length
    return rendered < total
  }

  function getZone(col: ColumnDef): PinZone {
    if (col.pinned === 'left') return 'left'
    if (col.pinned === 'right') return 'right'
    return 'center'
  }

  function getZoneAtX(relX: number): PinZone {
    const wrapper = wrapperRef.value
    if (!wrapper) return 'center'
    const utility = unrefMaybe(options.utilityWidth) ?? 0
    const leftPinnedWidth =
      utility + leftColumns.value.reduce((s, c) => s + resolveWidth(c), 0)
    const rightPinnedWidth = rightColumns.value.reduce(
      (s, c) => s + resolveWidth(c),
      0,
    )
    const viewportWidth = wrapper.clientWidth
    if (leftColumns.value.length > 0 && relX < leftPinnedWidth) return 'left'
    if (rightColumns.value.length > 0 && relX > viewportWidth - rightPinnedWidth)
      return 'right'
    return 'center'
  }

  function getZoneLayout(
    zone: PinZone,
  ): Array<{ field: string; x: number; width: number }> {
    const wrapper = wrapperRef.value
    if (!wrapper) return []

    const scrollLeft = wrapper.scrollLeft
    const viewportWidth = wrapper.clientWidth
    const utility = unrefMaybe(options.utilityWidth) ?? 0

    // Use each column's *rendered* width. The last centre column is
    // flex-stretched to fill the viewport, so its real on-screen width is
    // far larger than `resolveWidth`. The drag transforms below shift by
    // these widths — feeding the defined width slides a column only
    // part-way past a stretched neighbour, leaving it overlapping it.
    const rendered = buildRenderedWidths()
    const widthOf = (col: ColumnDef): number =>
      rendered.get(col.field) ?? resolveWidth(col)

    if (zone === 'left') {
      const items: Array<{ field: string; x: number; width: number }> = []
      let x = utility
      for (const col of leftColumns.value) {
        const w = widthOf(col)
        items.push({ field: col.field, x, width: w })
        x += w
      }
      return items
    }

    if (zone === 'right') {
      const cols = rightColumns.value
      const items: Array<{ field: string; x: number; width: number }> = []
      let rightEdge = viewportWidth
      for (let i = cols.length - 1; i >= 0; i--) {
        const w = widthOf(cols[i]!)
        rightEdge -= w
        items.push({ field: cols[i]!.field, x: rightEdge, width: w })
      }
      items.reverse()
      return items
    }

    // Center
    const leftPinnedWidth =
      utility + leftColumns.value.reduce((s, c) => s + widthOf(c), 0)
    const items: Array<{ field: string; x: number; width: number }> = []
    let x = leftPinnedWidth - scrollLeft
    for (const col of centerColumns.value) {
      const w = widthOf(col)
      items.push({ field: col.field, x, width: w })
      x += w
    }
    return items
  }

  /**
   * Compute the would-be drop slot for the cursor's current X — the
   * field BEFORE which the column would land if released right now,
   * the resolved zone, and the X of the insert-line indicator (relative
   * to the wrapper). Returns `null` when the wrapper isn't mounted.
   */
  function computeDropTarget(
    clientX: number,
  ): {
    indicatorX: number
    beforeField: string | null
    pin: 'left' | 'right' | null
  } | null {
    const wrapper = wrapperRef.value
    if (!wrapper) return null

    const rect = wrapper.getBoundingClientRect()
    const relX = clientX - rect.left
    const hoverZone = getZoneAtX(relX)

    const layout = getZoneLayout(hoverZone)
    if (layout.length === 0) {
      // Empty zone (e.g. no pinned-end columns) — drop at the start of
      // that zone. Fall back to "end of the global order".
      return {
        indicatorX: rect.left + relX,
        beforeField: null,
        pin: hoverZone === 'left' ? 'left' : hoverZone === 'right' ? 'right' : null,
      }
    }

    // Pick the slot whose midpoint sits to the right of the cursor.
    // `targetIndex === layout.length` ⇒ "after the last item".
    let targetIndex = layout.length
    for (let i = 0; i < layout.length; i++) {
      const item = layout[i]!
      const mid = item.x + item.width / 2
      if (relX < mid) {
        targetIndex = i
        break
      }
    }

    const beforeFieldInZone =
      targetIndex < layout.length ? layout[targetIndex]!.field : null

    let globalBeforeField: string | null
    if (beforeFieldInZone !== null) {
      globalBeforeField = beforeFieldInZone
    } else if (hoverZone === 'left') {
      globalBeforeField =
        centerColumns.value[0]?.field ?? rightColumns.value[0]?.field ?? null
    } else if (hoverZone === 'center') {
      globalBeforeField = rightColumns.value[0]?.field ?? null
    } else {
      globalBeforeField = null
    }

    const pin: 'left' | 'right' | null =
      hoverZone === 'left' ? 'left' : hoverZone === 'right' ? 'right' : null

    // X of the insert-line: the LEFT edge of the slot we'd drop into,
    // or the right edge of the last slot when dropping at the end.
    const indicatorX =
      targetIndex < layout.length
        ? rect.left + layout[targetIndex]!.x
        : rect.left + layout[layout.length - 1]!.x + layout[layout.length - 1]!.width

    return { indicatorX, beforeField: globalBeforeField, pin }
  }

  /**
   * Compute the per-field visual offsets for the current cursor position
   * and apply them as inline `transform: translateX(...)` on every cell
   * sharing that `data-field`. The CSS `transition: transform` declared
   * on `.adeo-grid-grid-wrapper[data-moving-field] [data-field]` (see AdeoGrid
   * styles) interpolates each change smoothly.
   *
   * Same-zone moves only — cross-zone (center → pinned) stays static
   * during the drag and only commits on `mouseup`. The math becomes
   * tangled across two layouts and the user already sees the dim and
   * the cursor — adding a partial slide there reads as more confusing
   * than nothing.
   */
  function applyLiveTransforms() {
    const wrapper = wrapperRef.value
    if (!wrapper) return

    const sourceCol = allColumns.value.find((c) => c.field === _field)
    if (!sourceCol) return

    const target = computeDropTarget(_mouseX)
    if (!target) {
      clearLiveTransforms()
      return
    }

    // Virtualised grids never hold every column in the DOM, so the live
    // per-frame slide cannot run — it would shift only the rendered window
    // and leave the dragged column's slot as an empty white gap (and
    // rendering all columns to fix that froze the grid). Show the
    // insert-line indicator instead; the FLIP slide on drop carries the
    // animation.
    if (isColumnVirtualized()) {
      clearLiveTransforms()
      showIndicator(target.indicatorX)
      return
    }

    const sourceZone = getZone(sourceCol)
    const dropZone = target.pin === 'left' ? 'left' : target.pin === 'right' ? 'right' : 'center'
    if (sourceZone !== dropZone) {
      // Cross-zone in flight — clear leftover transforms and show the
      // insert-line indicator at the would-be drop slot.
      clearLiveTransforms()
      showIndicator(target.indicatorX)
      return
    }
    // Same-zone — live cell transforms carry the visual feedback;
    // the indicator would just compete with them. Hide it.
    hideIndicator()

    const layout = getZoneLayout(sourceZone)
    const sourceIdx = layout.findIndex((l) => l.field === _field)
    if (sourceIdx < 0) {
      clearLiveTransforms()
      return
    }

    // Slot the column WOULD occupy in the OLD layout indexing. When the
    // drop is "before X", that's X's index. When dropping past the last
    // item, it's `layout.length` (i.e. after every column in the zone).
    let targetIdx: number
    if (target.beforeField) {
      targetIdx = layout.findIndex((l) => l.field === target.beforeField)
      if (targetIdx < 0) targetIdx = layout.length
    } else {
      targetIdx = layout.length
    }

    // Already at this slot — no-op (avoids a `translateX(0)` set that
    // would still trigger a CSS transition keyframe on every cell).
    if (sourceIdx === targetIdx || sourceIdx + 1 === targetIdx) {
      clearLiveTransforms()
      return
    }

    const draggedWidth = layout[sourceIdx]!.width
    const shifts = new Map<string, number>()

    if (sourceIdx < targetIdx) {
      // Dragging right — the dragged column slides over [sourceIdx+1 ..
      // targetIdx-1] which themselves slide left by the dragged width.
      let sum = 0
      for (let i = sourceIdx + 1; i < targetIdx; i++) sum += layout[i]!.width
      shifts.set(_field, sum)
      for (let i = sourceIdx + 1; i < targetIdx; i++) {
        shifts.set(layout[i]!.field, -draggedWidth)
      }
    } else {
      // Dragging left — symmetric: dragged slides over [targetIdx ..
      // sourceIdx-1] which slide right by the dragged width.
      let sum = 0
      for (let i = targetIdx; i < sourceIdx; i++) sum += layout[i]!.width
      shifts.set(_field, -sum)
      for (let i = targetIdx; i < sourceIdx; i++) {
        shifts.set(layout[i]!.field, draggedWidth)
      }
    }

    // Apply / clear inline transforms. Cells outside the moved range
    // get their transform cleared so they animate back to 0 if they
    // were shifted by a previous frame.
    const cells = wrapper.querySelectorAll<HTMLElement>('[data-field]')
    cells.forEach((c) => {
      const f = c.dataset.field
      if (!f) return
      const shift = shifts.get(f) ?? 0
      const next = shift === 0 ? '' : `translateX(${shift}px)`
      if (c.style.transform !== next) c.style.transform = next
    })
  }

  function clearLiveTransforms() {
    const wrapper = wrapperRef.value
    if (!wrapper) return
    const cells = wrapper.querySelectorAll<HTMLElement>('[data-field]')
    cells.forEach((c) => {
      if (c.style.transform) c.style.transform = ''
    })
  }

  // --- Auto-scroll near edges ---

  let _scrollRafId = 0
  let _scrollSpeed = 0

  function scrollTick() {
    _scrollRafId = 0
    const wrapper = wrapperRef.value
    if (!wrapper || _scrollSpeed === 0 || !isDragging.value) return
    wrapper.scrollLeft += _scrollSpeed
    applyLiveTransforms()
    _scrollRafId = requestAnimationFrame(scrollTick)
  }

  function updateAutoScroll() {
    const wrapper = wrapperRef.value
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    const relX = _mouseX - rect.left
    const edgeZone = 60
    const maxSpeed = 18
    if (relX < edgeZone) {
      _scrollSpeed = -maxSpeed * (1 - relX / edgeZone)
    } else if (relX > rect.width - edgeZone) {
      _scrollSpeed = maxSpeed * (1 - (rect.width - relX) / edgeZone)
    } else {
      _scrollSpeed = 0
    }
    if (_scrollSpeed !== 0 && _scrollRafId === 0) {
      _scrollRafId = requestAnimationFrame(scrollTick)
    }
  }

  function stopAutoScroll() {
    _scrollSpeed = 0
    if (_scrollRafId) {
      cancelAnimationFrame(_scrollRafId)
      _scrollRafId = 0
    }
  }

  // --- Event handlers ---

  // mousemove fires up to 1 event per pixel of movement. Coalesce all
  // events that land within the same animation frame into a single logic
  // cycle — the indicator + ghost only need to update at 60 FPS.
  let _moveRafId = 0

  function onMouseMove(e: MouseEvent) {
    _mouseX = e.clientX
    _mouseY = e.clientY
    if (_moveRafId) return
    _moveRafId = requestAnimationFrame(() => {
      _moveRafId = 0
      processMove()
    })
  }

  function processMove() {
    if (!_dragActivated) {
      const dx = _mouseX - _startX
      const dy = _mouseY - _startY
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return

      _dragActivated = true
      isDragging.value = true

      // CSS hooks — wrapper marker + reactive class on the moving cells.
      // Cells subscribe to `movingField` through the slot context and add
      // the dim class on their own next render — no JS-side classList
      // toggling, so no flicker on virtualised remounts.
      if (wrapperRef.value) wrapperRef.value.dataset.movingField = _field
      movingField.value = _field

      const ghost = ensureGhostEl()
      ghost.textContent = _headerName
      ghost.style.width = `${Math.min(_colWidth, 220)}px`
      ghost.style.display = ''

      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }

    updateGhost()
    applyLiveTransforms()
    updateAutoScroll()
  }

  function onMouseUp() {
    if (!_dragActivated) {
      cleanup()
      return
    }
    const target = computeDropTarget(_mouseX)
    const sourceCol = allColumns.value.find((c) => c.field === _field)
    const currentPin: 'left' | 'right' | null =
      sourceCol?.pinned === 'left'
        ? 'left'
        : sourceCol?.pinned === 'right'
          ? 'right'
          : null
    const sourceZone = sourceCol ? getZone(sourceCol) : 'center'
    const dropZone =
      target?.pin === 'left' ? 'left' : target?.pin === 'right' ? 'right' : 'center'

    if (!target) {
      cleanup()
      return
    }

    if (sourceZone === dropZone && !isColumnVirtualized()) {
      // Same-zone drop: cells were already animated into their target
      // slots via live transforms. Disable transitions briefly, commit
      // the reorder, and clear the transforms — the cells go from
      // "target visual via transform" → "new logical without transform"
      // which are the SAME physical position, so no jump is visible.
      const wrapper = wrapperRef.value
      if (wrapper) wrapper.dataset.colDropCommit = ''
      if (target.pin !== currentPin) onPin(_field, target.pin)
      onReorder(_field, target.beforeField)
      clearLiveTransforms()
      // Re-enable transitions for the next drag once Vue has flushed
      // and the browser has had a paint at the new state.
      nextTick(() => {
        if (wrapper) {
          void wrapper.offsetWidth
          delete wrapper.dataset.colDropCommit
        }
      })
    } else {
      // Cross-zone OR virtualised drop: cells weren't live-animated during
      // the drag (cross-zone and virtualised grids both skip the live
      // slide). Use the FLIP slide on commit so the reorder still reads as
      // a smooth motion rather than an abrupt jump.
      clearLiveTransforms()
      const beforeRects = captureCellOffsets()
      if (target.pin !== currentPin) onPin(_field, target.pin)
      onReorder(_field, target.beforeField)
      const ms = options.dropAnimationMs ?? DEFAULT_DROP_ANIMATION_MS
      if (ms > 0) nextTick(() => applyDropAnimation(beforeRects, ms))
    }

    cleanup()
  }

  // --- Helpers used at drop time only ---

  function captureCellOffsets(): Map<string, number> {
    const wrapper = wrapperRef.value
    const offsets = new Map<string, number>()
    if (!wrapper) return offsets
    const cells = wrapper.querySelectorAll<HTMLElement>('[data-field]')
    cells.forEach((c) => {
      const f = c.dataset.field
      if (!f) return
      // We only need ONE rect per field — the header cell's left edge
      // doubles as a reference for every body cell of the same column.
      if (!offsets.has(f)) offsets.set(f, c.getBoundingClientRect().left)
    })
    return offsets
  }

  function applyDropAnimation(beforeRects: Map<string, number>, ms: number) {
    const wrapper = wrapperRef.value
    if (!wrapper) return
    const cells = wrapper.querySelectorAll<HTMLElement>('[data-field]')
    const moves: Array<{ el: HTMLElement; dx: number }> = []

    // READ — collect every cell whose logical position changed.
    for (const c of cells) {
      const f = c.dataset.field
      if (!f) continue
      const oldX = beforeRects.get(f)
      if (oldX === undefined) continue
      const newX = c.getBoundingClientRect().left
      const dx = oldX - newX
      if (Math.abs(dx) < 0.5) continue
      moves.push({ el: c, dx })
    }
    if (moves.length === 0) return

    // WRITE phase 1 — apply the inverse transform with no transition so
    // cells visually stay at their pre-commit positions.
    for (const { el, dx } of moves) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${dx}px)`
    }

    // Single forced reflow to flush phase 1.
    void wrapper.offsetWidth

    // WRITE phase 2 — enable the transition and clear the transform so
    // the browser interpolates from `translateX(dx)` back to 0.
    const easing = 'cubic-bezier(0.2, 0.7, 0.4, 1.0)'
    for (const { el } of moves) {
      el.style.transition = `transform ${ms}ms ${easing}`
      el.style.transform = ''
    }

    // Cleanup styles when the slide completes — leaves no inline style
    // residue on the cells so future renders don't inherit stale
    // transforms or transitions.
    for (const { el } of moves) {
      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== 'transform') return
        el.style.transition = ''
        el.style.transform = ''
        el.removeEventListener('transitionend', onEnd as EventListener)
      }
      el.addEventListener('transitionend', onEnd as EventListener, {
        once: true,
      })
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && _dragActivated) {
      e.preventDefault()
      // Nothing to revert — no commit happens until mouseup, so simply
      // cancelling the gesture leaves the data untouched.
      cleanup()
    }
  }

  function cleanup() {
    _dragActivated = false
    isDragging.value = false
    stopAutoScroll()
    if (_moveRafId) {
      cancelAnimationFrame(_moveRafId)
      _moveRafId = 0
    }
    hideGhost()
    hideIndicator()
    clearLiveTransforms()
    movingField.value = null
    if (wrapperRef.value) delete wrapperRef.value.dataset.movingField
    _field = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('keydown', onKeyDown)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // --- Public API ---

  function startDrag(field: string, e: MouseEvent) {
    const col = allColumns.value.find((c) => c.field === field)
    if (!col) return
    if (col.suppressMovable === true) return

    e.preventDefault()

    _field = col.field
    _headerName = col.headerName
    _colWidth = resolveWidth(col)
    _sourceZone = getZone(col)
    _mouseX = e.clientX
    _mouseY = e.clientY
    _startX = e.clientX
    _startY = e.clientY
    _dragActivated = false

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keydown', onKeyDown)
  }

  onBeforeUnmount(() => {
    cleanup()
    destroyGhost()
    destroyIndicator()
  })

  return {
    isDragging,
    startDrag,
  }
}
