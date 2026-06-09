import React from 'react'
import { addons, types } from 'storybook/manager-api'
import { create } from 'storybook/theming'

// Custom brand for the portal — replaces the default Storybook logo at the
// top-left of the sidebar. The SVG lives in `public/` and is served at root
// because `main.ts` sets `staticDirs: ['../public']`.
const adeoTheme = create({
  base: 'light',
  brandTitle: 'adeo grid',
  brandUrl: '/',
  brandImage: '/adeo-grid-logo.svg',
  brandTarget: '_self',
})

addons.setConfig({ theme: adeoTheme })

/**
 * Two toolbar buttons in the portal's top bar that open the Vue and
 * Angular Storybooks in new browser tabs. This is the simplest way to
 * surface them from the portal UI without using Storybook Composition
 * (which has dev-mode CORS issues in SB 10) or iframes.
 *
 * Buttons are unconditionally visible (match: () => true) so they're
 * usable on every story / docs page of the portal.
 */
const ADDON_ID = 'adeo-portal-tools'

const buttonBase: React.CSSProperties = {
  marginLeft: 6,
  padding: '0 10px',
  height: 24,
  borderRadius: 4,
  border: '1px solid',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'inherit',
}

addons.register(ADDON_ID, () => {
  addons.add(`${ADDON_ID}/grid-vue`, {
    type: types.TOOL,
    title: 'Ouvrir Grid (Vue) dans un nouvel onglet',
    match: () => true,
    render: () => (
      <button
        key="adeo-grid-vue"
        type="button"
        title="Grid (Vue) — http://localhost:6006"
        onClick={() => window.open('http://localhost:6006', '_blank', 'noopener,noreferrer')}
        style={{ ...buttonBase, color: '#42b883', borderColor: '#42b883' }}
      >
        Grid (Vue) <span aria-hidden>↗</span>
      </button>
    ),
  })

  addons.add(`${ADDON_ID}/grid-angular`, {
    type: types.TOOL,
    title: 'Ouvrir Grid (Angular) dans un nouvel onglet',
    match: () => true,
    render: () => (
      <button
        key="adeo-grid-angular"
        type="button"
        title="Grid (Angular) — http://localhost:6007"
        onClick={() => window.open('http://localhost:6007', '_blank', 'noopener,noreferrer')}
        style={{ ...buttonBase, color: '#dd0031', borderColor: '#dd0031' }}
      >
        Grid (Angular) <span aria-hidden>↗</span>
      </button>
    ),
  })
})
