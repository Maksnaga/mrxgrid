/**
 * Teleports a listbox (e.g. MCombobox dropdown) out of a clipped container
 * (overflow:auto / contain:paint) to document.body, keeping it positioned
 * under its control element via position:fixed.
 *
 * Usage: call `teleport(comboboxRootEl)` once after the component mounts.
 * Cleanup is automatic when the element is removed from the DOM.
 */
export function teleportListbox(comboboxEl: HTMLElement) {
  const listbox = comboboxEl.querySelector<HTMLElement>('.mc-combobox__listbox')
  const control = comboboxEl.querySelector<HTMLElement>('.mc-combobox__input')
  if (!listbox || !control) return

  document.body.appendChild(listbox)

  Object.assign(listbox.style, {
    position: 'fixed',
    zIndex: '9999',
    width: `${Math.max(control.offsetWidth, 180)}px`,
    visibility: 'visible',
    opacity: '1',
  })

  function updatePosition() {
    const rect = control!.getBoundingClientRect()
    listbox!.style.top = `${rect.bottom}px`
    listbox!.style.left = `${rect.left}px`
  }

  updatePosition()

  const scrollHandler = () => updatePosition()
  window.addEventListener('scroll', scrollHandler, true)
  window.addEventListener('resize', scrollHandler)

  const observer = new MutationObserver(() => {
    updatePosition()
  })
  observer.observe(comboboxEl, { attributes: true, attributeFilter: ['class'] })

  const cleanup = () => {
    window.removeEventListener('scroll', scrollHandler, true)
    window.removeEventListener('resize', scrollHandler)
    observer.disconnect()
    listbox.remove()
  }

  const parentObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.removedNodes) {
        if (
          node === comboboxEl ||
          (node instanceof HTMLElement && node.contains(comboboxEl))
        ) {
          cleanup()
          parentObserver.disconnect()
          return
        }
      }
    }
  })

  const parent = comboboxEl.parentElement
  if (parent) {
    parentObserver.observe(parent, { childList: true, subtree: true })
  }
}
