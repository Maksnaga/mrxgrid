<script setup lang="ts">
/**
 * Spreadsheet-style inline formula editor — replaces the plain `<input>` for
 * cells whose column has `allowFormula: true`. Renders a `contenteditable`
 * surface where each token (cell ref, range, function name, number, string,
 * operator, …) is wrapped in a coloured `<span>`. Cell-ref tokens use the
 * exact same colour as the highlight border drawn on the referenced cell —
 * the user reads at a glance which `D5` in the formula maps to which cell.
 *
 * The component owns:
 *   - tokenisation on every `input`
 *   - caret offset save/restore around DOM rewrites
 *   - keydown forwarding (Enter / Tab / Esc / F4 are handled upstream)
 *   - external `modelValue` updates from the grid (e.g. click-to-pick) —
 *     when the prop changes outside of typing, we re-render and restore
 *     the caret to the end of the inserted text.
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { tokenizeFormulaEditor } from '../../features/formula/formula-tokenizer'
import { paletteColorVar } from '../../features/formula/formula-ref-palette'

const props = defineProps<{
  modelValue: string
  fieldOrder: readonly string[]
  /** Per-token color resolver — a stable colour index per ref/range key.
   *  Falls back to a deterministic hash when not provided so the editor
   *  works standalone in tests. */
  colorFor?: (key: string) => { index: number; cssVar: string }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  keydown: [e: KeyboardEvent]
  blur: []
  input: [value: string]
}>()

const root = ref<HTMLDivElement | null>(null)

function fallbackColorFor(key: string): { index: number; cssVar: string } {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  const index = Math.abs(hash) % 6
  return { index, cssVar: paletteColorVar(index) }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function tokensToHtml(text: string): string {
  // Plain text outside formulas — no colouring.
  if (!text.startsWith('=')) return escapeHtml(text)
  let tokens: ReturnType<typeof tokenizeFormulaEditor>
  try {
    tokens = tokenizeFormulaEditor(text, { fieldOrder: [...props.fieldOrder] })
  } catch {
    return escapeHtml(text)
  }
  // Reassemble using the original substring per token so whitespace and
  // unknown segments are preserved exactly. Token coverage isn't perfect
  // for partial formulas, so fall back to verbatim slicing for any gap.
  let out = ''
  let cursor = 0
  for (const t of tokens) {
    if (t.start > cursor) out += escapeHtml(text.slice(cursor, t.start))
    const piece = escapeHtml(text.slice(t.start, t.end))
    const cls = `mrx-tok mrx-tok--${t.kind}`
    if (t.kind === 'ref' && piece) {
      const resolver = props.colorFor ?? fallbackColorFor
      const { cssVar } = resolver(piece)
      out += `<span class="${cls}" style="color: ${cssVar}">${piece}</span>`
    } else {
      out += `<span class="${cls}">${piece}</span>`
    }
    cursor = t.end
  }
  if (cursor < text.length) out += escapeHtml(text.slice(cursor))
  return out
}

const html = computed(() => tokensToHtml(props.modelValue))

// ─── Caret management ─────────────────────────────────────────────────────
function getCaret(): number {
  const el = root.value
  if (!el || typeof window === 'undefined') return 0
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return el.textContent?.length ?? 0
  const range = sel.getRangeAt(0)
  if (!el.contains(range.endContainer)) return el.textContent?.length ?? 0
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.endContainer, range.endOffset)
  return pre.toString().length
}

function setCaret(offset: number): void {
  const el = root.value
  if (!el || typeof window === 'undefined') return
  const range = document.createRange()
  let i = 0
  let placed = false
  function walk(node: Node) {
    if (placed) return
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const len = node.nodeValue?.length ?? 0
      if (i + len >= offset) {
        range.setStart(node, Math.max(0, offset - i))
        range.collapse(true)
        placed = true
        return
      }
      i += len
    } else {
      for (const child of Array.from(node.childNodes)) walk(child)
    }
  }
  walk(el)
  if (!placed) {
    range.selectNodeContents(el)
    range.collapse(false)
  }
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

// ─── Render + sync ────────────────────────────────────────────────────────
function rerenderPreservingCaret(caret: number) {
  const el = root.value
  if (!el) return
  el.innerHTML = html.value
  setCaret(caret)
}

function onInputEvent() {
  const text = root.value?.textContent ?? ''
  const caret = getCaret()
  emit('update:modelValue', text)
  emit('input', text)
  // Re-render in nextTick so the prop has propagated and `html` is fresh.
  nextTick(() => rerenderPreservingCaret(caret))
}

watch(
  () => props.modelValue,
  (v) => {
    const el = root.value
    if (!el) return
    if (el.textContent === v) return
    // External update (e.g. pick handler inserted a ref) — re-render and
    // place the caret at the end so the user keeps typing seamlessly.
    el.innerHTML = tokensToHtml(v)
    setCaret(v.length)
  },
)

onMounted(() => {
  const el = root.value
  if (!el) return
  el.innerHTML = html.value
  el.focus()
  setCaret(props.modelValue.length)
})

defineExpose({
  focus: () => root.value?.focus(),
  getCaret,
  setCaret,
})
</script>

<template>
  <div
    ref="root"
    class="adeo-grid-formula-editor"
    contenteditable="plaintext-only"
    spellcheck="false"
    role="textbox"
    aria-multiline="false"
    @input="onInputEvent"
    @keydown="emit('keydown', $event)"
    @blur="emit('blur')"
  />
</template>

<style scoped lang="scss">
.adeo-grid-formula-editor {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: m.get-spacing('100') m.get-spacing('150');
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.4;
  background: var(--color-background-primary, #fff);
  color: var(--color-text-primary, #1f2937);
  outline: 2px solid var(--color-text-accent, #0071ce);
  outline-offset: -2px;
  overflow: hidden;
  white-space: nowrap;
  box-sizing: border-box;
  caret-color: var(--color-text-primary, #1f2937);
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok) {
  white-space: pre;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--ref) {
  font-weight: 600;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--fn) {
  color: #0071ce;
  font-weight: 700;
  text-transform: uppercase;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--number) {
  color: #b45309;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--string) {
  color: #047857;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--bool) {
  color: #7c3aed;
  font-weight: 600;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--op),
.adeo-grid-formula-editor :deep(.adeo-grid-tok--comma),
.adeo-grid-formula-editor :deep(.adeo-grid-tok--colon) {
  color: #6b7280;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--lparen),
.adeo-grid-formula-editor :deep(.adeo-grid-tok--rparen) {
  color: #1e293b;
  font-weight: 700;
}

.adeo-grid-formula-editor :deep(.adeo-grid-tok--unknown) {
  color: var(--color-status-text-error, #d11717);
  text-decoration: underline wavy;
}
</style>
