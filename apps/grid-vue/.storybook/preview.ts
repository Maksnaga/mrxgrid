import type { Preview } from '@storybook/vue3-vite'

// CSS as raw strings via Vite's `?inline` — inlining keeps us within the
// tokens package's `exports` map (deep paths to ./build/* aren't allowed).
import leroymerlinTheme from '@mozaic-ds/tokens/theme?inline'
import adeoTheme from '@mozaic-ds/tokens/adeo/theme?inline'
import bricocenterTheme from '@mozaic-ds/tokens/bricocenter/theme?inline'
import mbrandTheme from '@mozaic-ds/tokens/mbrand/theme?inline'

import '@mozaic-ds/vue/style.css'
import './preview.css'

type ThemeId = 'leroymerlin' | 'adeo' | 'bricocenter' | 'mbrand'

const THEME_CSS: Record<ThemeId, string> = {
  leroymerlin: leroymerlinTheme as unknown as string,
  adeo: adeoTheme as unknown as string,
  bricocenter: bricocenterTheme as unknown as string,
  mbrand: mbrandTheme as unknown as string,
}

const THEME_LABELS: Record<ThemeId, string> = {
  leroymerlin: 'Leroy Merlin',
  adeo: 'Adeo',
  bricocenter: 'Bricocenter',
  mbrand: 'MBrand',
}

const THEME_STYLE_ID = 'grid-active-theme-style'

function applyTheme(theme: ThemeId) {
  if (typeof document === 'undefined') return
  let style = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = THEME_STYLE_ID
    document.head.appendChild(style)
  }
  if (style.textContent !== THEME_CSS[theme]) {
    style.textContent = THEME_CSS[theme]
  }
  document.documentElement.dataset.theme = theme
}

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    options: {
      storySort: {
        order: [
          // Live demos only — la doc conceptuelle / tutoriels vit dans le
          // portail mutualisé (port 6008).
          'Stories',
          [
            'Introduction',
            'Basics',
            'Selection',
            'Editing',
            'Filtering',
            'Sorting',
            'Grouping',
            'Pinned Columns',
            'Virtual Scroll',
            'Pagination',
            'Renderers',
            'Lazy Loading',
            'Formula Engine',
            'Row Expansion',
            'Customization',
          ],
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Mozaic brand theme',
      defaultValue: 'leroymerlin',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: (Object.keys(THEME_LABELS) as ThemeId[]).map((id) => ({
          value: id,
          title: THEME_LABELS[id],
        })),
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, ctx) => {
      const theme = (ctx.globals.theme ?? 'leroymerlin') as ThemeId
      applyTheme(theme)
      return {
        components: { story },
        template: `<div class="sb-grid-root" data-theme="${theme}"><story /></div>`,
      }
    },
  ],
}

export default preview
