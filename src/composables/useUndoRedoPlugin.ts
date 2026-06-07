/**
 * Undo / Redo plugin — persists the grid's history stacks to
 * `localStorage` under `mrx-grid-history:<storageKey>` and binds the
 * <kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd> / <kbd>⌘Y</kbd> shortcuts at the
 * document level as a fallback. The grid itself also handles the
 * shortcut on its own `@keydown` (when the wrapper has focus); this
 * plugin's listener only fires when the grid's local handler didn't
 * grab the event — typical case: focus was momentarily on `<body>`
 * after an Enter-commit.
 *
 * Edits, paste, cut, fill, delete are recorded automatically by the
 * grid into `engine.history`. The plugin doesn't intercept any of
 * that — it only adds keyboard ergonomics and persistence.
 *
 * Pass `storageKey: null` (or omit) to keep history in memory only.
 *
 * Usage:
 *
 *   <AdeoGrid
 *     :plugins="[useUndoRedoPlugin({ storageKey: 'lm-products-v1' })]"
 *     history-id="lm-products-v1"
 *     @cell-edit="onCellEdit"
 *   />
 *
 * (Pass the same id to `history-id` and `storageKey` — both wire to
 * the same localStorage entry.)
 */

import type { AdeoGridPlugin } from '@/components/AdeoGrid/models/plugin.model'

export interface UndoRedoPluginOptions {
  /**
   * `localStorage` namespace. When provided, undo/redo stacks are
   * mirrored to `mrx-grid-history:<storageKey>` and restored on next
   * mount. Pass `null` (or omit) to keep history in memory only.
   */
  storageKey?: string | null
  /**
   * If true (default), attach a document-level keydown listener as a
   * fallback so the shortcut still works when focus is on `<body>`
   * (e.g. right after a commit-on-Enter when the input was removed
   * from the DOM but focus hasn't snapped back to the grid wrapper).
   * Disable when the host app already binds these keys globally.
   */
  bindKeyboardShortcuts?: boolean
}

export function useUndoRedoPlugin(options: UndoRedoPluginOptions = {}): AdeoGridPlugin {
  const { storageKey = null, bindKeyboardShortcuts = true } = options

  return {
    name: 'undo-redo',
    init({ engine }) {
      engine.history.attach(storageKey)

      if (!bindKeyboardShortcuts) {
        return () => engine.history.attach(null)
      }

      function onKeyDown(e: KeyboardEvent) {
        const mod = e.ctrlKey || e.metaKey
        if (!mod) return

        // Use `e.key` (the actual letter the user sees on their keycap).
        // `e.code` is the PHYSICAL position on a US-QWERTY layout, so on
        // AZERTY the Z key reports `e.code === 'KeyW'` — checking code
        // breaks undo/redo for every non-QWERTY user.
        const key = e.key.toLowerCase()
        if (key !== 'z' && key !== 'y') return

        // Don't steal the browser's native text-undo inside inline editors.
        const t = e.target as HTMLElement | null
        if (t) {
          const tag = t.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) {
            return
          }
        }

        if (e.defaultPrevented) return

        const wantsRedo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)

        if (wantsRedo) {
          if (engine.history.canRedo.value) {
            e.preventDefault()
            engine.history.redo()
          }
        } else if (key === 'z' && !e.shiftKey) {
          if (engine.history.canUndo.value) {
            e.preventDefault()
            engine.history.undo()
          }
        }
      }

      // Document-level (bubble phase). The grid's wrapper-level
      // `@keydown` runs first when the wrapper has focus — if it
      // handled the shortcut, `defaultPrevented` is true and this
      // listener exits without doing anything. Otherwise we catch
      // the event here as a fallback.
      document.addEventListener('keydown', onKeyDown)

      // When the grid lives in an iframe (e.g. Storybook's preview
      // panel), keystrokes fired while the OUTER chrome has focus
      // never reach the inner document. Walk up the parent chain and
      // attach the same listener to every same-origin ancestor's
      // document so the shortcut works regardless of which frame
      // owns focus. Cross-origin parents throw on access — we catch
      // and stop walking.
      const parentDocs: Document[] = []
      try {
        let w: Window | null = window.parent
        while (w && w !== w.parent) {
          if (w.document && w.document !== document) {
            w.document.addEventListener('keydown', onKeyDown)
            parentDocs.push(w.document)
          }
          w = w.parent
        }
        // Top-most window (window === window.parent terminates the
        // loop above). Capture it too if it isn't `document` already.
        if (w && w.document && w.document !== document && !parentDocs.includes(w.document)) {
          w.document.addEventListener('keydown', onKeyDown)
          parentDocs.push(w.document)
        }
      } catch {
        // Cross-origin parent — give up on parent listeners; the
        // wrapper-level @keydown still works once the user clicks
        // the grid.
      }

      return () => {
        document.removeEventListener('keydown', onKeyDown)
        for (const d of parentDocs) {
          try {
            d.removeEventListener('keydown', onKeyDown)
          } catch {
            // ignore — same cross-origin guard
          }
        }
        engine.history.attach(null)
      }
    },
  }
}
