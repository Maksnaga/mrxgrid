# Installation et premier rendu

> On part de zéro. À la fin de cette page tu as un projet Vue 3 + Vite **ou** Angular 21 qui affiche un grid vide à l'écran.

## Pré-requis

**Communs aux deux stacks** :

- **Node** >= 20.19 ou >= 22.12
- **TypeScript** 5.9+ (strict recommandé)

**Côté Vue** :

- **Vue** 3.5+ (Composition API + `<script setup>`)
- **Vite** 7 ou 8

**Côté Angular** :

- **Angular** 21.x (zoneless ou zone-based — les deux marchent)
- **Angular CLI** 21.x

Si tu connais pas Vue 3 Composition API, va lire [la doc officielle Vue](https://vuejs.org/guide/extras/composition-api-faq.html). Si tu connais pas les signals Angular, va lire la [doc Angular signals](https://angular.dev/guide/signals) — ce tuto ne ré-explique ni `ref` / `computed` Vue ni `signal` / `computed` Angular.

## Étape 1 : Scaffold du projet

### Vue

```bash
npm create vite@latest mon-projet -- --template vue-ts
cd mon-projet
npm install
```

### Angular

```bash
npm create @angular@latest mon-projet -- --strict --standalone --style=scss --routing=false
cd mon-projet
npm install
```

## Étape 2 : Installer le grid + Mozaic

### Vue

```bash
npm install @adeo/grid-vue @mozaic-ds/vue @mozaic-ds/icons-vue @mozaic-ds/styles
```

### Angular

```bash
npm install @adeo/grid-angular @mozaic-ds/angular @mozaic-ds/icons @mozaic-ds/styles
```

`@mozaic-ds/styles` est obligatoire dans les deux cas — c'est de là que viennent les tokens (couleurs, spacings) que le grid consomme via CSS variables.

> **Piège.** Si tu installes la lib sans les styles, le grid s'affiche mais avec un look cassé : pas de couleurs, padding aléatoire, icons sans alignement. **Toujours les 4 packages ensemble.**

## Étape 3 : Importer les styles

### Vue

```ts
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'

// Mozaic — tokens + composants
import '@mozaic-ds/styles/scss/main.scss'

// adeo-grid — styles internes du grid
import '@adeo/grid-vue/styles.scss'

createApp(App).mount('#app')
```

### Angular

```scss
/* src/styles.scss */
@use '@mozaic-ds/styles/scss/main' as *;
@use '@adeo/grid-angular/styles' as *;
```

L'ordre compte : Mozaic d'abord (les CSS vars sont définies), puis le grid qui les consomme. Inverse l'ordre et le grid utilise des fallbacks au lieu des couleurs Adeo.

## Étape 4 : Premier composant

### Vue

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { AdGridVue, type ColumnDef } from '@adeo/grid-vue'

const columns: ColumnDef[] = []
const rows: unknown[] = []
</script>

<template>
  <ad-grid-vue :columns="columns" :rows="rows" :height="640" />
</template>
```

### Angular

```ts
// src/app/app.component.ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { AdGridVue, type GridColumn } from '@adeo/grid-angular'

@Component({
  selector: 'app-root',
  imports: [Grid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ad-grid-angular [columns]="columns()" [rows]="rows()" [height]="640" />
  `,
})
export class AppComponent {
  columns = signal<GridColumn<unknown>[]>([])
  rows = signal<unknown[]>([])
}
```

Lance le serveur de dev (`npm run dev` côté Vue, `ng serve` côté Angular) — tu dois voir un grid vide avec un message "Le catalogue est vide" et la toolbar par défaut (fullscreen, settings, etc.).

> **Note.** `height="640"` est obligatoire si tu veux que le grid ait une taille fixe. Sans ça il prend la hauteur de son contenu — un grid vide fait 0 px de haut. Tu peux aussi mettre `fullscreen` mais c'est l'utilisateur qui devrait toggle ça via la toolbar, pas toi en prop initial.

## Étape 5 : Vérifier la console

Ouvre la console navigateur. Tu ne dois voir **aucun** warning.

**Symptômes côté Vue** :

- `Failed to resolve component: MTag` -> tu as oublié d'installer `@mozaic-ds/vue`.
- `Cannot read property 'value' of undefined` sur un computed Mozaic -> tu as oublié `@mozaic-ds/styles` ou tu l'as importé après le grid.
- `[Vue warn]: Invalid prop: type check failed for prop "columns"` -> ta variable `columns` n'est pas un array.

**Symptômes côté Angular** :

- `NG0303: Can't bind to 'columns' since it isn't a known property of 'ad-grid'` -> tu as oublié d'importer `Grid` dans `imports: [...]`.
- Pas de styles -> vérifie l'ordre dans `styles.scss` (Mozaic avant grid).
- `NG0950: Input is required but no value is available` -> tu as déclaré un input `required` mais n'as pas passé la valeur dans le template.

## Étape 6 : Storybook (optionnel)

Les deux libs publient un Storybook avec toutes les démos jouables :

| Stack    | URL local                  | Description                       |
|----------|----------------------------|-----------------------------------|
| Vue      | `http://localhost:6006`    | Storybook `@adeo/grid-vue`        |
| Angular  | `http://localhost:6007`    | Storybook `@adeo/grid-angular`    |
| Portail  | `http://localhost:6008`    | Documentation framework-agnostic  |

## Prochaine étape

[Tutoriel 2 — Tableau simple](?path=/docs/tutoriel-tableau-simple--docs) : on ajoute 5 colonnes et 10 lignes hardcodées pour voir le grid afficher de la vraie donnée.
