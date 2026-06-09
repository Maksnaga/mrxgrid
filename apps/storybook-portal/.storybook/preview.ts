// Storybook 10 : `@storybook/html` package removed — the framework-vite
// package (`@storybook/html-vite`) is self-contained and exports `Preview`.
import type { Preview } from '@storybook/html-vite'
// Typography polish for the rendered Markdown chapters (Docs/Spec).
// See preview.css for the rationale.
import './preview.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      // Manual order — without this, Storybook sorts by title alphabetically
      // and the spec chapters end up scrambled (Annexe first, etc.).
      storySort: {
        order: [
          // Top level — pages flat, no "Docs/" wrapper
          'Welcome',
          'Architecture monorepo',
          'Runbook quotidien',
          // Spec mutualisée — chapitres à plat
          'Sommaire spec',
          'Introduction',
          'Données & colonnes',
          'Pipeline de données',
          'Interactions',
          'Extensibilité',
          'Theming, performance & API',
          'Annexe',
          // Guide — concepts (issus de la doc Vue, mutualisés)
          'Guide',
          [
            'Introduction',
            'Quick Start',
            'Architecture',
            'State & Engine',
            'Virtualization',
            'Data Pipeline',
            'Theming',
            'Performance',
            'API Reference',
          ],
          // Tutoriels — pas à pas (issus de la doc Vue, mutualisés)
          'Tutoriel',
          [
            'Sommaire',
            'Installation',
            'Tableau simple',
            'Tableau complexe',
            'Fetch + pagination serveur',
            'Tri et filtre serveur',
            'Édition + persistance optimiste',
            'Bulk actions et sélection',
            'Gotchas',
          ],
        ],
      },
    },
  },
}

export default preview
