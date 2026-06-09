# Theming

> 4 thèmes Mozaic prêts, 3 modes de densité, et l'API pour faire le tien.

## Les 4 thèmes Mozaic

Le grid lit ses couleurs depuis les CSS custom properties Mozaic. Chaque thème est un fichier `.css` (en réalité du SCSS compilé) qui pose les vars sur `:root`. Tu charges **un seul** thème à la fois, dans le `styles.scss` de l'app hôte.

| Thème | Import |
|---|---|
| **Leroy Merlin** (par défaut) | `@import '@mozaic-ds/tokens/theme';` |
| **Adeo** | `@import '@mozaic-ds/tokens/adeo/theme';` |
| **Bricocenter** | `@import '@mozaic-ds/tokens/bricocenter/theme';` |
| **MBrand** | `@import '@mozaic-ds/tokens/mbrand/theme';` |

Les deux librairies (Vue et Angular) consomment **exactement** les mêmes tokens Mozaic. Le choix du thème est une décision de l'application hôte, pas une prop du grid.

## Switch dynamique de thème

Les fichiers de thème ciblent tous `:root` — on ne peut pas tous les charger simultanément (le dernier gagne). Pour switcher au runtime, charge la CSS comme URL et bascule un `<style>` :

```ts
import lmCss     from '@mozaic-ds/tokens/theme?inline'
import adeoCss   from '@mozaic-ds/tokens/adeo/theme?inline'
import bricoCss  from '@mozaic-ds/tokens/bricocenter/theme?inline'
import mbrandCss from '@mozaic-ds/tokens/mbrand/theme?inline'

const THEMES = { lm: lmCss, adeo: adeoCss, brico: bricoCss, mbrand: mbrandCss }

function applyTheme(id: keyof typeof THEMES): void {
  let style = document.getElementById('app-theme') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'app-theme'
    document.head.appendChild(style)
  }
  style.textContent = THEMES[id]
  document.documentElement.dataset.theme = id
}
```

C'est exactement ce que fait le toolbar du portail Storybook (en haut à droite).

## CSS variables consommées par le grid

Le grid n'invente aucune couleur — tout passe par des variables Mozaic. Pour override, redéclare-les sur un ancêtre du grid (par ex. `.grid-root` ou plus haut).

| Var | Usage |
|---|---|
| `--color-background-primary` | fond cellules + header |
| `--color-background-secondary` | fond hover row, group rows |
| `--color-background-accent` | cellule sélectionnée, fill target |
| `--color-text-primary` | texte par défaut |
| `--color-text-secondary` | labels, helpers, count |
| `--color-text-tertiary` | icônes inactives, hint text |
| `--color-text-accent` | chevron tri, fill handle, accents |
| `--color-border-primary` | bordures cellules / wrapper |
| `--color-border-secondary` | resize handle hover |
| `--color-status-border-error` | cellule invalide outline |
| `--color-status-background-error` | cellule active+invalide |
| `--font-family` | police de la grid |

## Chargement des fonts (responsabilité de l'hôte)

Le grid **n'embarque pas** de `@font-face`. Il consomme `--font-family`, c'est tout. L'app hôte est responsable de charger les fonts de brand — typiquement via un `@import` dans `styles.scss`, des blocs `@font-face` ou un `<link>` dans `index.html`.

Piège historique : si un wrapper de l'app (ou de Storybook) déclare sa propre `font-family`, il **masque** la surcharge des tokens Mozaic. Règle : les wrappers doivent **hériter**, pas surcharger.

## Densité des lignes

Trois modes. Seules les **cellules body** (pas le header) changent de hauteur, pour garder les contrôles header (kebab, sort, filter) à une position stable.

### Vue

```vue
<ad-grid-vue :density="'compact'" ... />       <!-- 25 px de ligne -->
<ad-grid-vue :density="'default'" ... />       <!-- 37 px (par défaut) -->
<ad-grid-vue :density="'comfortable'" ... />   <!-- 45 px -->
```

### Angular

```html
<ad-grid-angular [density]="'compact'" ... />
<ad-grid-angular [density]="'default'" ... />
<ad-grid-angular [density]="'comfortable'" ... />
```

Implémentation : une classe sur `.grid-wrapper--compact|comfortable` applique des paddings ad-hoc sur `.grid-cell`. Identique des deux côtés — c'est du SCSS partagé.

## Customiser une feature visuelle

Pas de prop, pas d'override programmatique — tu cibles les classes BEM du grid dans le SCSS de ton app :

### Couleur de la cellule active

```scss
.my-app .grid-cell--active::after {
  border-color: hotpink;
}
```

### Hauteur de header custom

```scss
.my-app .grid-header-cell {
  padding-top: 14px;
  padding-bottom: 14px;
  background: #f9fafb;
}
```

### Fill handle plus visible

```scss
.my-app .grid-cell__fill-handle {
  width: 10px;
  height: 10px;
  bottom: -5px;
  right: -5px;
}
```

## Dark mode

Non exposé par le grid lui-même. Si les tokens `--color-*` de l'hôte se redéfinissent en dark mode sous une classe / un attribut (`[data-theme="dark"]`, `.dark`, peu importe), le grid suit de manière transparente — il n'a pas de palette en niveaux de gris codée en dur.

## Renderers Mozaic intégrés

### `'tag'` — MTag pour catégorisation

Disponible des deux côtés via le `renderer: 'tag'` builtin dans `ColumnDef` :

```ts
{
  field: 'status',
  renderer: 'tag',
  rendererProps: {
    labelMap: {
      'in-stock':  { label: 'En stock', appearance: 'success' },
      'out':       { label: 'Rupture',  appearance: 'danger' },
      'preorder':  { label: 'Précommande', appearance: 'neutral' },
    },
  },
}
```

### `defineStatusRenderer<T>(map)` — version typée

#### Vue

```ts
import { defineStatusRenderer } from '@adeo/grid-vue'

const StatusCell = defineStatusRenderer<'open' | 'closed'>({
  open:   { label: 'Ouvert',  appearance: 'success' },
  closed: { label: 'Fermé',   appearance: 'danger' },
})

// usage
{ field: 'status', renderer: StatusCell }
```

Le helper appelle `markRaw()` automatiquement (le component ne doit pas être proxy-é par Vue) et utilise une palette de couleurs Mozaic cohérente.

#### Angular

```ts
import { defineStatusRenderer } from '@adeo/grid-angular'

const StatusCell = defineStatusRenderer<'open' | 'closed'>({
  open:   { label: 'Ouvert',  appearance: 'success' },
  closed: { label: 'Fermé',   appearance: 'danger' },
})

// usage
{ field: 'status', renderer: StatusCell }
```

Côté Angular, le helper retourne directement la classe de composant (pas de `markRaw` nécessaire), avec la même palette.
