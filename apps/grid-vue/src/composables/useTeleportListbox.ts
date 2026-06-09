/**
 * Teleports a listbox (e.g. MCombobox dropdown) out of a clipped container
 * (overflow:auto / contain:paint) to document.body, keeping it positioned
 * under its control element via position:fixed.
 *
 * Returns a controller. The caller drives open/close via `setOpen()` —
 * typically from the combobox's `update:open` emit — because once the
 * listbox lives in `document.body` it's no longer a descendant of the
 * combobox and Mozaic's own open/close CSS no longer applies.
 *
 * The teleported listbox starts hidden. Call `setOpen(true)` to reveal it.
 * Cleanup runs automatically when the combobox is removed from the DOM, or
 * call `destroy()` manually.
 */
export interface TeleportListboxController {
  setOpen(open: boolean): void
  destroy(): void
}

export function teleportListbox(comboboxEl: HTMLElement): TeleportListboxController | undefined {
  const listbox = comboboxEl.querySelector<HTMLElement>('.mc-combobox__listbox')
  const control = comboboxEl.querySelector<HTMLElement>('.mc-combobox__input')
  if (!listbox || !control) return

  document.body.appendChild(listbox)

  Object.assign(listbox.style, {
    position: 'fixed',
    zIndex: '9999',
    width: `${Math.max(control.offsetWidth, 180)}px`,
    visibility: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
  })

  // The listbox now lives at body level, so any host (e.g. a column filter
  // overlay) that listens to `document.mousedown` for click-outside treats
  // clicks on the listbox as outside and dismisses itself. Stop propagation
  // here — clicks inside a dropdown should never be considered "outside" of
  // its anchor.
  const swallowMousedown = (e: MouseEvent) => e.stopPropagation()
  listbox.addEventListener('mousedown', swallowMousedown)

  function updatePosition() {
    const rect = control!.getBoundingClientRect()
    listbox!.style.top = `${rect.bottom}px`
    listbox!.style.left = `${rect.left}px`
    listbox!.style.width = `${Math.max(control!.offsetWidth, 180)}px`
  }

  function setOpen(open: boolean) {
    if (open) {
      updatePosition()
      listbox!.style.visibility = 'visible'
      listbox!.style.opacity = '1'
      listbox!.style.pointerEvents = 'auto'
    } else {
      listbox!.style.visibility = 'hidden'
      listbox!.style.opacity = '0'
      listbox!.style.pointerEvents = 'none'
    }
  }

  const scrollHandler = () => updatePosition()
  window.addEventListener('scroll', scrollHandler, true)
  window.addEventListener('resize', scrollHandler)

  function destroy() {
    window.removeEventListener('scroll', scrollHandler, true)
    window.removeEventListener('resize', scrollHandler)
    listbox!.removeEventListener('mousedown', swallowMousedown)
    parentObserver.disconnect()
    listbox!.remove()
  }

  const parentObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.removedNodes) {
        if (
          node === comboboxEl ||
          (node instanceof HTMLElement && node.contains(comboboxEl))
        ) {
          destroy()
          return
        }
      }
    }
  })

  const parent = comboboxEl.parentElement
  if (parent) {
    parentObserver.observe(parent, { childList: true, subtree: true })
  }

  return { setOpen, destroy }
}
