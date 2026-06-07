# MONOREPO SETUP — `mrx-grid-monorepo`

> Guide pas-à-pas pour migrer les deux repos existants (`mozaic-ng`
> Angular + `mrxgrid` Vue) dans un seul monorepo, avec packages
> partagés et un Storybook unique qui compose les deux libs.
>
> **Stack** : pnpm workspaces + Turborepo + Storybook Composition.
>
> **Hypothèse** : tu pars de zéro, sur une machine avec
> Node ≥ 20.19, git ≥ 2.30, et un shell POSIX (bash/zsh).

---

## Sommaire

1. [Vision et architecture cible](#1-vision-et-architecture-cible)
2. [Prérequis](#2-prérequis)
3. [Phase 1 — Squelette du monorepo](#3-phase-1--squelette-du-monorepo)
4. [Phase 2 — Migrer le projet Angular](#4-phase-2--migrer-le-projet-angular)
5. [Phase 3 — Migrer le projet Vue](#5-phase-3--migrer-le-projet-vue)
6. [Phase 4 — Créer les packages partagés](#6-phase-4--créer-les-packages-partagés)
7. [Phase 5 — Storybook Portal (composition)](#7-phase-5--storybook-portal-composition)
8. [Phase 6 — CI/CD GitHub Actions](#8-phase-6--cicd-github-actions)
9. [Phase 7 — Quotidien dev](#9-phase-7--quotidien-dev)
10. [Versioning et release (Changesets)](#10-versioning-et-release-changesets)
11. [FAQ et troubleshooting](#11-faq-et-troubleshooting)

---

## 1. Vision et architecture cible

```
mrx-grid-monorepo/
├── .changeset/                       ← versioning géré par Changesets
├── .github/workflows/                ← CI GitHub Actions
├── .turbo/                           ← cache local Turbo (gitignored)
├── apps/
│   ├── grid-angular/                 ← ex-`mozaic-ng/projects/mozaic-ng`
│   │   ├── projects/mozaic-ng/grid/  ← lib Angular
│   │   ├── .storybook/
│   │   ├── angular.json
│   │   └── package.json              ← `@mrx/grid-angular`
│   ├── grid-vue/                     ← ex-`mrxgrid`
│   │   ├── src/components/MrxGrid/
│   │   ├── .storybook/
│   │   ├── vite.config.ts
│   │   └── package.json              ← `@mrx/grid-vue`
│   └── storybook-portal/             ← agrégateur
│       ├── .storybook/main.ts        ← `refs` vers les 2 SB
│       ├── stories/                  ← doc transverse (tuto, spec)
│       └── package.json
├── packages/
│   ├── spec/                         ← `@mrx/spec` — chapitres .md
│   ├── types/                        ← `@mrx/types` — ColumnDef, etc.
│   └── mocks/                        ← `@mrx/mocks` — fixtures + JSON
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── package.json                      ← workspace root
└── README.md
```

**Principe** :

- **`apps/*`** — applications déployables (les deux libs + le portal
  Storybook). Chacune a son propre build, ses propres dépendances.
- **`packages/*`** — code partagé consommé par plusieurs apps. Versionné
  avec Changesets, publié sur ton registry npm interne si besoin.
- **`pnpm-workspace.yaml`** — déclare les répertoires qui sont des
  packages workspace (ce qui rend `@mrx/types` accessible depuis
  `apps/grid-vue`).
- **`turbo.json`** — décrit les tâches (build / test / storybook /
  lint) et leurs dépendances pour orchestrer le rebuild incremental.

---

## 2. Prérequis

```bash
node --version    # ≥ 20.19 ou ≥ 22.12
git --version     # ≥ 2.30
corepack enable   # active pnpm/yarn nativement (Node ≥ 16.10)
```

Installe pnpm via Corepack (recommandé) :

```bash
corepack prepare pnpm@9.15.0 --activate
pnpm --version    # devrait afficher 9.15.0
```

Installe Turborepo globalement (optionnel, on utilisera surtout
`pnpm turbo` qui pointe sur la version locale) :

```bash
npm install -g turbo
```

---

## 3. Phase 1 — Squelette du monorepo

### 3.1 Créer le repo

```bash
mkdir mrx-grid-monorepo
cd mrx-grid-monorepo
git init
echo "node_modules/\n.turbo/\ndist/\n*.log\n.DS_Store" > .gitignore
```

### 3.2 `package.json` racine

```json
{
  "name": "mrx-grid-monorepo",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": "^20.19.0 || >=22.12.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "storybook": "turbo run storybook",
    "storybook:portal": "pnpm --filter @mrx/storybook-portal storybook",
    "clean": "turbo run clean && rm -rf node_modules .turbo",
    "format": "prettier --write .",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "turbo run build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "prettier": "^3.4.0",
    "turbo": "^2.3.0",
    "typescript": "~5.6.3"
  }
}
```

### 3.3 `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 3.4 `turbo.json`

Décrit le **graphe de tâches**. Une tâche peut dépendre des tâches
d'autres packages (`^build` = build des dépendances d'abord).

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", "tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "tsconfig.json",
        "package.json",
        "vite.config.*",
        "angular.json"
      ],
      "outputs": ["dist/**", "build/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/**", "vitest.config.*", "jest.config.*"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*", "eslint.config.*"]
    },
    "storybook": {
      "cache": false,
      "persistent": true
    },
    "storybook-build": {
      "dependsOn": ["^build"],
      "inputs": [".storybook/**", "src/**", "stories/**"],
      "outputs": ["storybook-static/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Notes** :

- `cache: false` sur `storybook` car c'est un serveur dev (jamais
  cacheable). `persistent: true` indique à Turbo que c'est un long-
  running task (ne bloque pas les autres tâches en parallèle).
- `storybook-build` (séparé) = build statique pour déploiement, est
  cacheable.
- `globalDependencies` invalide tout le cache quand un de ces
  fichiers change (utile pour les `.env` partagés).

### 3.5 `tsconfig.base.json`

Config TS partagée que tous les apps/packages **étendent** :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@mrx/types": ["./packages/types/src/index.ts"],
      "@mrx/types/*": ["./packages/types/src/*"],
      "@mrx/mocks": ["./packages/mocks/src/index.ts"],
      "@mrx/mocks/*": ["./packages/mocks/src/*"]
    }
  }
}
```

**Astuce** : les `paths` permettent à n'importe quel app de faire
`import { ColumnDef } from '@mrx/types'` sans avoir à exposer un
sub-path complet.

### 3.6 Init pnpm

```bash
pnpm install
```

À ce stade : `node_modules/` à la racine + un workspace vide.

```bash
git add .
git commit -m "chore: init monorepo skeleton (pnpm + turbo + ts)"
```

---

## 4. Phase 2 — Migrer le projet Angular

### 4.1 Importer avec `git subtree` (préserve l'historique)

Depuis la racine du monorepo :

```bash
# Ajoute le repo source comme remote
git remote add grid-angular-source git@github.com:adeo/mozaic-ng.git
git fetch grid-angular-source

# Importe dans apps/grid-angular en conservant les commits
git subtree add --prefix=apps/grid-angular grid-angular-source main --squash
```

> `--squash` collapse l'historique en un seul commit. Drop-le si tu
> veux garder les commits individuels (au prix d'un repo plus lourd).

Si tu préfères une migration "propre" sans historique :

```bash
mkdir -p apps/grid-angular
cp -r /path/to/mozaic-ng/* apps/grid-angular/
rm -rf apps/grid-angular/.git
```

### 4.2 Adapter le `package.json` de l'app

```json
{
  "name": "@mrx/grid-angular",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "ng build mozaic-ng",
    "test": "ng test mozaic-ng --watch=false",
    "lint": "eslint .",
    "storybook": "ng run mozaic-ng:storybook",
    "storybook-build": "ng run mozaic-ng:build-storybook"
  },
  "dependencies": {
    "@angular/core": "^18.0.0",
    "@mrx/types": "workspace:*",
    "@mrx/mocks": "workspace:*"
  }
}
```

**Le `workspace:*`** est ce qui rend pnpm résolu les packages locaux
au lieu du registry npm.

### 4.3 Adapter le `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*.ts", "projects/**/*.ts"],
  "exclude": ["**/*.spec.ts"]
}
```

`extends` hérite des `paths` (`@mrx/types`, `@mrx/mocks`) du base.

### 4.4 Vérification

```bash
pnpm install                                # met à jour le lockfile root
pnpm --filter @mrx/grid-angular build       # build via Turbo + Angular
```

### 4.5 Commit

```bash
git add .
git commit -m "feat(monorepo): migrate grid-angular into apps/"
```

---

## 5. Phase 3 — Migrer le projet Vue

Même procédure que Phase 2.

### 5.1 Subtree

```bash
git remote add grid-vue-source git@github.com:maksnaga/mrxgrid.git
git fetch grid-vue-source
git subtree add --prefix=apps/grid-vue grid-vue-source main --squash
```

### 5.2 `apps/grid-vue/package.json`

```json
{
  "name": "@mrx/grid-vue",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vue-tsc --build && vite build",
    "test": "vitest run",
    "lint": "eslint . --fix",
    "storybook": "storybook dev -p 6006",
    "storybook-build": "storybook build"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "@mozaic-ds/vue": "^2.19.1",
    "@mrx/types": "workspace:*",
    "@mrx/mocks": "workspace:*"
  }
}
```

### 5.3 `apps/grid-vue/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "vue",
    "moduleResolution": "Bundler",
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

### 5.4 Adapter les imports

Dans `src/composables/`, remplace les types locaux dupliqués par
ceux du package partagé :

```ts
// AVANT (chaque projet redéfinit son ColumnDef)
import type { ColumnDef } from '../types'

// APRÈS
import type { ColumnDef } from '@mrx/types'
```

(Voir Phase 4 pour comment `@mrx/types` est créé.)

### 5.5 Vérification

```bash
pnpm install
pnpm --filter @mrx/grid-vue build
pnpm --filter @mrx/grid-vue test
```

### 5.6 Commit

```bash
git add .
git commit -m "feat(monorepo): migrate grid-vue into apps/"
```

---

## 6. Phase 4 — Créer les packages partagés

### 6.1 `packages/types/` — `@mrx/types`

Les contrats TypeScript partagés entre Angular et Vue. C'est le code
qu'on a déjà côté `mrxgrid/src/components/MrxGrid/types.ts` — on le
remonte en package.

```bash
mkdir -p packages/types/src
cd packages/types
```

`packages/types/package.json` :

```json
{
  "name": "@mrx/types",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "publishConfig": {
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js"
      }
    }
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "~5.6.3"
  }
}
```

**Le double `exports`** :
- Le bloc top-level pointe vers `src/` → consumé en TS direct côté
  workspace (pas de build nécessaire).
- `publishConfig.exports` est utilisé **à la publication npm** : pointe
  vers `dist/` compilé.

`packages/types/tsconfig.json` :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*.ts"]
}
```

`packages/types/src/index.ts` :

```ts
// Re-export des contrats partagés
export * from './column'
export * from './row'
export * from './filter'
export * from './sort'
export * from './selection'
```

`packages/types/src/column.ts` (extrait — copier depuis
`mrxgrid/src/components/MrxGrid/types.ts`) :

```ts
export interface ColumnDef<T = unknown> {
  field: string
  headerName: string
  width?: string
  minWidth?: string
  maxWidth?: string
  pinned?: 'start' | 'end' | null
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  editable?: boolean
  valueGetter?: (row: T) => unknown
  valueFormatter?: (value: unknown, row: T) => string
  // … etc
}

export interface RowData {
  [key: string]: unknown
  __mrxSkeleton?: boolean
  __mrxType?: 'group' | 'row' | 'detail'
}
```

### 6.2 `packages/mocks/` — `@mrx/mocks`

Pour partager les fixtures (le JSON Adeo PIM par exemple) entre les
deux Storybooks et les tests des deux apps.

```bash
mkdir -p packages/mocks/src
```

`packages/mocks/package.json` :

```json
{
  "name": "@mrx/mocks",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./adeo-products": "./src/adeo-products.json"
  },
  "scripts": {
    "lint": "eslint src"
  }
}
```

`packages/mocks/src/index.ts` :

```ts
import adeoProducts from './adeo-products.json'

export interface AdeoProduct {
  id: number
  adeoKey: string
  productBrand: string | null
  // … (re-définir ou importer depuis @mrx/types)
  [key: string]: unknown
}

export const ADEO_PRODUCTS = adeoProducts.products as AdeoProduct[]
export const ADEO_FIELDS = adeoProducts.meta.fields

export function generateLMProducts(count: number) {
  // … générateur LM products (déplacé depuis __stories__/_fixtures)
}
```

Copie le JSON depuis `apps/grid-vue/src/app/mock/adeo-products.json`
vers `packages/mocks/src/adeo-products.json`, puis dans `grid-vue`
remplace l'import par `import { ADEO_PRODUCTS } from '@mrx/mocks'`.

### 6.3 `packages/spec/` — `@mrx/spec`

Les chapitres Markdown de mutualisation (cf. le `plan.md` qu'on a
écrit avant). Pas de code, juste de la doc.

```bash
mkdir -p packages/spec
cp /path/to/plan.md packages/spec/00-overview/00-vision.md
# … etc selon la structure du plan.md
```

`packages/spec/package.json` :

```json
{
  "name": "@mrx/spec",
  "version": "0.1.0",
  "private": true,
  "files": ["**/*.md"]
}
```

Le Storybook portal (Phase 5) consomme ces .md via un loader MDX et
les affiche dans la sidebar `Documentation/Spec/`.

### 6.4 Wirer les packages dans les apps

Dans `apps/grid-vue/package.json` :

```json
"dependencies": {
  "@mrx/types": "workspace:*",
  "@mrx/mocks": "workspace:*"
}
```

Pareil dans `apps/grid-angular/package.json`.

```bash
pnpm install   # met à jour le lockfile et symlinke les workspaces
```

Vérifie qu'un import marche :

```ts
// apps/grid-vue/src/composables/useColumns.ts
import type { ColumnDef } from '@mrx/types'
// ↑ TS résout via les `paths` du tsconfig.base.json
```

### 6.5 Commit

```bash
git add packages/
git commit -m "feat(monorepo): shared packages (types, mocks, spec)"
```

---

## 7. Phase 5 — Storybook Portal (composition)

L'app `storybook-portal` ne contient **aucun composant** propre. Elle
agrège les Storybooks de Angular et Vue via le mécanisme de
composition de Storybook 7+.

### 7.1 Init

```bash
mkdir -p apps/storybook-portal
cd apps/storybook-portal
pnpm init
```

`apps/storybook-portal/package.json` :

```json
{
  "name": "@mrx/storybook-portal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "storybook": "storybook dev -p 6010",
    "storybook-build": "storybook build -o storybook-static",
    "clean": "rm -rf storybook-static node_modules .storybook/cache"
  },
  "devDependencies": {
    "@storybook/addon-docs": "^10.4.1",
    "@storybook/blocks": "^10.4.1",
    "@storybook/html-vite": "^10.4.1",
    "storybook": "^10.4.1",
    "vite": "^7.0.0"
  }
}
```

> Le portal utilise `@storybook/html-vite` qui est le framework
> "neutre" (pas de couplage Vue ni Angular). Le portal n'a pas besoin
> de connaître les frameworks qu'il compose — seulement de pointer
> vers leurs URLs.

### 7.2 `.storybook/main.ts`

```ts
import type { StorybookConfig } from '@storybook/html-vite'

const config: StorybookConfig = {
  framework: '@storybook/html-vite',
  stories: ['../stories/**/*.mdx'],
  addons: ['@storybook/addon-docs'],

  /**
   * Composition — les deux Storybooks externes sont référencés.
   * En dev, on pointe sur les ports locaux. En prod, sur les URLs
   * déployées.
   */
  refs: (config, { configType }) => {
    const isProd = configType === 'PRODUCTION'
    return {
      'grid-angular': {
        title: 'Grid Angular',
        url: isProd
          ? 'https://mrx.adeo.dev/storybook-angular'
          : 'http://localhost:6007',
        expanded: false,
      },
      'grid-vue': {
        title: 'Grid Vue',
        url: isProd
          ? 'https://mrx.adeo.dev/storybook-vue'
          : 'http://localhost:6006',
        expanded: false,
      },
    }
  },
}

export default config
```

### 7.3 `.storybook/preview.ts`

```ts
import type { Preview } from '@storybook/html-vite'

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: [
          'Documentation',
          ['Vue d\'ensemble', 'Tutoriel', 'Spec'],
          '*',
        ],
      },
    },
  },
}

export default preview
```

### 7.4 Contenu propre du portal

Le portal héberge la doc **transverse** :

```
apps/storybook-portal/stories/
├── overview/
│   └── 00-Vue-d-ensemble.mdx        ← landing page du portal
├── tutoriel/
│   ├── 00-Index.mdx                 ← le tuto qu'on a fait
│   ├── 01-Installation.mdx
│   └── ...
└── spec/
    ├── 00-Vision.mdx
    ├── 10-Rows.mdx
    └── ...                          ← chapitres de @mrx/spec
```

Pour les chapitres de spec, tu peux soit copier les `.mdx` à la main,
soit utiliser un loader Vite qui les pull depuis `packages/spec/` au
build time.

### 7.5 Lancer le portal en dev

```bash
# Terminal 1 — Storybook Angular
pnpm --filter @mrx/grid-angular storybook    # → http://localhost:6007

# Terminal 2 — Storybook Vue
pnpm --filter @mrx/grid-vue storybook         # → http://localhost:6006

# Terminal 3 — Portal qui les agrège
pnpm --filter @mrx/storybook-portal storybook # → http://localhost:6010
```

Ouvre `http://localhost:6010`. Tu vois :

```
Sidebar
├── Documentation
│   ├── Vue d'ensemble
│   ├── Tutoriel (1-8)
│   └── Spec (Rows, Columns, ...)
├── Grid Angular ▶  (collapse, charge à la demande)
└── Grid Vue ▶       (idem)
```

Au clic sur "Grid Angular", la sous-arborescence du Storybook Angular
charge en iframe et s'affiche dans le portal.

### 7.6 Script root pour tout lancer en une commande

`package.json` racine :

```json
"scripts": {
  "dev": "turbo run storybook --parallel",
  ...
}
```

```bash
pnpm dev   # lance les 3 SB en parallèle dans le même terminal
```

### 7.7 Commit

```bash
git add apps/storybook-portal/
git commit -m "feat(storybook-portal): compose Angular + Vue Storybooks"
```

---

## 8. Phase 6 — CI/CD GitHub Actions

### 8.1 Setup du remote cache Turbo

Crée un compte gratuit sur [Vercel](https://vercel.com), va dans
Settings → Tokens, et crée un token "Remote Cache".

Dans le repo GitHub, Settings → Secrets and variables → Actions :

- `TURBO_TOKEN` = le token Vercel
- `TURBO_TEAM` = ton team slug Vercel

### 8.2 Workflow CI

`.github/workflows/ci.yml` :

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  build-test-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # nécessaire pour `turbo --filter=...[HEAD^1]`

      - uses: pnpm/action-setup@v3
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Lint changed packages
        run: pnpm turbo run lint --filter=...[HEAD^1]

      - name: Build changed packages
        run: pnpm turbo run build --filter=...[HEAD^1]

      - name: Test changed packages
        run: pnpm turbo run test --filter=...[HEAD^1]
```

**`--filter=...[HEAD^1]`** = "tout package modifié depuis le commit
précédent + ses dépendants". Sur une PR qui touche `apps/grid-vue/`,
Turbo build/test/lint **uniquement** `grid-vue` et `storybook-portal`
(qui dépend de lui). `grid-angular` est skipped.

### 8.3 Déploiement Storybook

Trois Storybooks à déployer :
- `grid-angular/storybook-static/` → `mrx.adeo.dev/storybook-angular/`
- `grid-vue/storybook-static/` → `mrx.adeo.dev/storybook-vue/`
- `storybook-portal/storybook-static/` → `mrx.adeo.dev/` (root)

`.github/workflows/deploy-storybook.yml` :

```yaml
name: Deploy Storybooks

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }

      - run: pnpm install --frozen-lockfile

      - name: Build all Storybooks
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
        run: pnpm turbo run storybook-build

      - name: Assemble output
        run: |
          mkdir -p dist
          cp -r apps/storybook-portal/storybook-static/* dist/
          cp -r apps/grid-angular/storybook-static dist/storybook-angular
          cp -r apps/grid-vue/storybook-static dist/storybook-vue

      - name: Deploy to NAS / S3 / GitHub Pages
        run: |
          # ← adapter selon ta cible
          rsync -avz dist/ user@nas.adeo.dev:/var/www/mrx/
```

**Important** : le portal référence les SB Angular/Vue via leurs URLs.
Au build prod (`configType === 'PRODUCTION'`), les `refs` pointent
vers `https://mrx.adeo.dev/storybook-*/`. Donc une fois les 3 buildés
et déployés sur le même domaine, la composition fonctionne en prod
comme en dev.

### 8.4 Cache hit en pratique

Avec Turbo Remote Cache activé :

- PR #1 d'Alice touche `apps/grid-vue/MrxGridCell.vue` → build complet
  cache miss (~2 min).
- PR #2 de Bob touche `apps/grid-vue/MrxGridHeader.vue` → cache hit
  sur `@mrx/types`, `@mrx/mocks`, `@mrx/grid-angular`, `@mrx/storybook-portal`.
  Build seulement `@mrx/grid-vue` (~30 sec).
- PR #3 de Charlie modifie un .md de `@mrx/spec` → cache hit total
  (la spec ne fait pas partie de la chaîne de build des libs). CI
  finit en ~10 sec.

---

## 9. Phase 7 — Quotidien dev

### 9.1 Commandes courantes

```bash
# Installer les deps (à chaque clone ou pull qui change package.json)
pnpm install

# Dev — lance tous les Storybooks en parallèle
pnpm dev

# Dev — focus sur Vue uniquement
pnpm --filter @mrx/grid-vue storybook

# Build une lib
pnpm --filter @mrx/grid-vue build

# Test une lib
pnpm --filter @mrx/grid-vue test

# Build tout
pnpm build

# Lint tout
pnpm lint

# Nettoyer (delete dist + node_modules + cache Turbo local)
pnpm clean
```

### 9.2 Bosser sur un package partagé

Quand tu modifies `packages/types/src/column.ts` :

- Les apps consumers voient **immédiatement** le changement (TS pointe
  sur les sources via les `paths` du tsconfig.base.json).
- Pas besoin de rebuild manuellement `@mrx/types`.
- Le typecheck dans les apps reflète instantanément la nouvelle
  interface.

### 9.3 Bosser sur une lib sans installer l'autre framework

Tu veux toucher uniquement Vue et tu n'as pas envie d'avoir Angular
installé localement :

```bash
pnpm install --filter "@mrx/grid-vue..."
```

`...` = "ce package + ses dépendances" (pas les autres apps). Tu
n'installes pas `@angular/*`.

### 9.4 Ajouter une nouvelle dépendance

```bash
# À une app spécifique
pnpm --filter @mrx/grid-vue add lodash-es

# À un package partagé
pnpm --filter @mrx/types add -D some-dev-dep

# À la racine (dev tools : prettier, husky, etc.)
pnpm add -wD prettier
```

### 9.5 Voir le graph des dépendances

```bash
pnpm turbo run build --graph
```

Génère un PDF / SVG du DAG. Utile pour expliquer "pourquoi quand je
modifie types tout rebuild".

---

## 10. Versioning et release (Changesets)

### 10.1 Init

```bash
pnpm changeset init
```

Crée `.changeset/config.json` :

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@mrx/grid-vue", "@mrx/grid-angular"]],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@mrx/storybook-portal"]
}
```

**`linked`** : les deux libs partagent leur numéro de version (quand
l'une bump major, l'autre suit). Garantit la parité visible.

**`ignore`** : le portal est private, pas publié.

### 10.2 Workflow

À chaque PR qui change du code public :

```bash
pnpm changeset
# → interactive prompt : quels packages ? quel niveau (patch/minor/major) ?
# → écrit un .md dans .changeset/
git add .changeset/
git commit -m "chore: changeset for filter API fix"
```

Au merge sur main, un bot (`changesets/action`) ouvre une PR "Version
Packages" qui :
- Bumpe les versions dans les `package.json`
- Met à jour les `CHANGELOG.md` des packages
- Tag les commits

Quand cette PR est mergée, le job `release` :

```bash
pnpm turbo run build
pnpm changeset publish   # publie sur le registry npm
```

---

## 11. FAQ et troubleshooting

### Q. Mon collègue ne veut bosser que sur Vue, doit-il installer Angular ?

Non. `pnpm install --filter "@mrx/grid-vue..."` installe uniquement le
sous-graphe nécessaire. Angular et ses peer deps sont skipped.

### Q. TypeScript de mon Angular est en 5.4 et celui de Vue est en 5.6, problème ?

Non, chaque app a son `tsconfig.json` qui `extends` la base. Si tu as
besoin de versions TS différentes, déclare-les dans les `devDependencies`
de chaque app, pnpm résout indépendamment.

**Exception** : `@mrx/types` est consommé par les deux. Vise la
**version la plus basse** des deux apps pour le compilateur de
`@mrx/types`. Sinon, l'app sur l'ancienne version ne pourra pas
lire les `.d.ts` générés.

### Q. Comment je gère les versions de Storybook (10 côté Vue, 9 côté Angular) ?

Pas de problème — chaque app a sa propre dep, son propre `.storybook/`.
Le portal lui utilise sa version (10) indépendamment. La composition
fonctionne tant que tous les SB sont **≥ 7** (intro de la feature).

### Q. Mon CI prend 10 minutes même avec Turbo, normal ?

Vérifie :
- `TURBO_TOKEN` + `TURBO_TEAM` bien injectés (sinon pas de cache distribué).
- `actions/checkout` avec `fetch-depth: 2` pour que `[HEAD^1]` fonctionne.
- `pnpm install --frozen-lockfile` (sinon pnpm réinstalle tout à chaque push).
- Pas de `cache: false` indésiré dans `turbo.json` (sauf sur dev
  servers).

### Q. Comment publier `@mrx/types` sur un registry privé Adeo (jfrog) ?

Dans `packages/types/package.json` :

```json
"publishConfig": {
  "registry": "https://artifactory.adeo.fr/api/npm/npm-internal/",
  "access": "restricted"
}
```

Dans `.npmrc` à la racine :

```
@mrx:registry=https://artifactory.adeo.fr/api/npm/npm-internal/
//artifactory.adeo.fr/api/npm/npm-internal/:_authToken=${NPM_TOKEN}
```

Le secret `NPM_TOKEN` est injecté en CI.

### Q. Comment ajouter un 3ème framework (React) demain ?

```bash
mkdir apps/grid-react
cd apps/grid-react
pnpm init
# → installe @mrx/types, @mrx/mocks
# → écrit le Storybook React
# → ajoute son URL dans storybook-portal/.storybook/main.ts refs
```

C'est tout. La spec `@mrx/spec` te donne déjà toutes les sémantiques
à implémenter.

### Q. Comment migrer si j'ai des PRs en cours sur les repos sources ?

Solution la plus propre :
1. Merge / freeze les PRs ouvertes sur les repos sources.
2. Fais la migration `git subtree` à un moment où les sources sont
   stables.
3. Annonce au repo source : "ce repo est maintenant archivé, suite
   dans le monorepo X".
4. Si une PR doit reprendre, le contributeur la re-soumet contre le
   monorepo (pas de reprise possible via git subtree).

### Q. Mon Storybook portal affiche "loading…" puis rien sur les refs

Causes possibles :
- L'URL référencée ne sert pas un `index.json` au format Storybook
  attendu. Vérifie que les SB Angular/Vue tournent bien.
- CORS bloqué. Si tu dev sur des ports différents (6006/6007/6010),
  les SB enfants doivent autoriser le port du portal. Storybook 7+
  le gère automatiquement en dev. En prod, sers les 3 SB sur le même
  domaine.

### Q. Comment je rollback un changement breaking de `@mrx/types` ?

```bash
git revert <sha-du-commit>
pnpm changeset
# → "@mrx/types": patch — "revert breaking change in ColumnDef.editable"
```

La PR de version bumpera `@mrx/types` d'un patch et les deux libs
suivront.

---

## Récap des phases

| Phase | Output                                          | Durée estimée |
|-------|-------------------------------------------------|---------------|
| 1     | Squelette + configs root                        | 30 min        |
| 2     | Angular migré dans `apps/grid-angular`          | 1-2 h         |
| 3     | Vue migré dans `apps/grid-vue`                  | 1-2 h         |
| 4     | Packages `types` / `mocks` / `spec` créés       | 2-3 h         |
| 5     | Storybook portal opérationnel local             | 2 h           |
| 6     | CI GitHub Actions + déploiement                 | 1 jour        |
| 7+    | Adoption au quotidien                           | continu       |

Total : **~3 jours** de boulot focus pour avoir le monorepo en place
et un CI propre. Beaucoup moins si tu as déjà des CI sur les deux
repos sources que tu peux porter.

---

## Prochaines étapes

1. Crée le repo vide et fais la Phase 1.
2. Choisis un des deux frameworks à migrer en premier (le plus actif,
   ou le plus simple). Migre-le seul d'abord, valide que tout marche.
3. Migre le second.
4. Crée les packages partagés AU FUR ET À MESURE qu'apparaît un besoin
   réel (ne pré-design pas tout).
5. Storybook portal après que les deux apps soient stables.
6. CI en dernier — c'est la partie qui demande le plus d'itérations.

Bonne chance — et tiens la matrice de parité à jour (cf. `plan.md` du
projet de mutualisation).
