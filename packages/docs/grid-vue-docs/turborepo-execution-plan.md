# Plan d'exécution — Mise en place Turborepo `adeo-grid-monorepo`

> **Date** : 2026-06-08
> **Contexte** : restructurer le repo `mrxgrid` (Vue + demo) en monorepo Turborepo, et y intégrer la lib grid Angular extraite depuis `mozaic-angular`.
>
> **Choix retenus** :
> - **Scope Angular** : grid **uniquement** (extraction depuis `mozaic-angular/projects/mozaic-ng/src/lib/grid/`). Le grid dépendra de `@mozaic-ds/angular` installé via npm comme peer.
> - **Migration** : **renommer** le repo `mrxgrid` → `adeo-grid-monorepo` puis **restructure in-place** (l'historique git est préservé).
>
> Ce plan complète et remplace progressivement `MONOREPO-SETUP.md` (qui partait d'un repo vierge).

---

## Sommaire

1. [Vision et architecture cible](#1-vision-et-architecture-cible)
2. [Prérequis](#2-prérequis)
3. [Phase 0 — Snapshot + branche de migration](#3-phase-0--snapshot--branche-de-migration)
4. [Phase 1 — Renommer le repo + créer le skeleton monorepo](#4-phase-1--renommer-le-repo--créer-le-skeleton-monorepo)
5. [Phase 2 — Déplacer le contenu actuel dans `apps/grid-vue/`](#5-phase-2--déplacer-le-contenu-actuel-dans-appsgrid-vue)
6. [Phase 3 — Extraire le grid Angular depuis `mozaic-angular`](#6-phase-3--extraire-le-grid-angular-depuis-mozaic-angular)
7. [Phase 4 — Transformer les imports Angular relatifs vers `@mozaic-ds/angular`](#7-phase-4--transformer-les-imports-angular-relatifs)
8. [Phase 5 — Setup pnpm workspaces + Turborepo + Storybook Composition](#8-phase-5--setup-pnpm-workspaces--turborepo--storybook-composition)
9. [Phase 6 — CI/CD GitHub Actions](#9-phase-6--cicd-github-actions)
10. [Phase 7 — Versioning et release (Changesets)](#10-phase-7--versioning-et-release)
11. [Validation finale et runbook quotidien](#11-validation-finale-et-runbook-quotidien)

---

## 1. Vision et architecture cible

```
adeo-grid-monorepo/                  ← ex-mrxgrid renommé
├── .changeset/                       ← versioning Changesets
├── .github/workflows/                ← CI GitHub Actions
├── .turbo/                           ← cache local Turbo (gitignored)
├── apps/
│   ├── grid-vue/                     ← contenu actuel du repo mrxgrid
│   │   ├── src/components/Grid/
│   │   ├── src/app/                  ← demo + renderers consumer
│   │   ├── .storybook/
│   │   ├── vite.config.ts
│   │   └── package.json              ← `@adeo/grid-vue`
│   ├── grid-angular/                 ← grid extrait de mozaic-angular
│   │   ├── src/lib/grid/             ← lib elle-même
│   │   ├── src/public-api.ts
│   │   ├── .storybook/
│   │   ├── ng-package.json
│   │   ├── angular.json
│   │   └── package.json              ← `@adeo/grid-angular`
│   └── storybook-portal/             ← agrégateur Storybook Composition
│       ├── .storybook/main.ts        ← `refs` vers grid-vue + grid-angular
│       ├── stories/                  ← doc transverse (spec, plan)
│       └── package.json
├── packages/
│   ├── spec/                         ← `@adeo/spec` — chapitres .md mutualisés
│   └── docs/                         ← `vue-vs-angular-sync.md`, plan.md
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── package.json                      ← workspace root
├── .gitignore
├── README.md
└── MONOREPO-SETUP.md                 ← guide existant (peut être mergé avec ce plan)
```

**Principe** :

- **`apps/grid-vue/`** : la lib Vue + sa demo + son Storybook (≈ contenu actuel `mrxgrid/`).
- **`apps/grid-angular/`** : la lib grid Angular publiée comme package npm `@adeo/grid-angular`. Dépend de `@mozaic-ds/angular` (peer dep) pour les composants Mozaic utilisés (button, tag, select, checkbox, datepicker, combobox, drawer service…).
- **`apps/storybook-portal/`** : Storybook minimal qui compose via `refs` les Storybooks publiés par les 2 libs. Pour le dev local, refs pointent sur les URLs locales (`localhost:6006`, `localhost:6007`). Pour la prod, sur les builds statiques.
- **`packages/spec/`** : la doc framework-agnostique mutualisée (chapitres `40-features/sorting.md`, `30-interactions/clipboard.md`, etc.).
- **`packages/docs/`** : les fichiers transverses actuels (`vue-vs-angular-sync.md`, `plan.md`, `MONOREPO-SETUP.md`).

---

## 2. Prérequis

```bash
# Vérifications
node --version    # ≥ 20.19 ou ≥ 22.12
git --version     # ≥ 2.30
corepack enable

# Installer pnpm via Corepack
corepack prepare pnpm@9.15.0 --activate
pnpm --version    # devrait afficher 9.15.0

# Turbo (optionnel — on utilisera surtout pnpm turbo qui pointe sur la version locale)
# Pas besoin d'install global.
```

**Espace disque** : prévoir ~2-3 GB pour la migration (copies temporaires, node_modules dupliqués pendant la transition).

---

## 3. Phase 0 — Snapshot + branche de migration

### 3.1 Tag de snapshot pour rollback facile

```bash
cd ~/Documents/GitHub/maks-grid-vuejs/mrxgrid
git tag pre-monorepo-snapshot
git push origin pre-monorepo-snapshot   # backup distant
```

### 3.2 Branche de migration

```bash
git checkout -b feat/turborepo-monorepo
```

### 3.3 Snapshot complet du repo Angular source

Garde une copie de référence du grid Angular avant extraction :

```bash
cp -r ~/Documents/GitHub/mozaic-angular/projects/mozaic-ng/src/lib/grid \
      /tmp/grid-angular-snapshot
```

---

## 4. Phase 1 — Renommer le repo + créer le skeleton monorepo

### 4.1 Renommer le repo GitHub

Via l'UI GitHub : `Settings → Repository name` → `mrxgrid` → `adeo-grid-monorepo`.

Côté local :

```bash
cd ~/Documents/GitHub/maks-grid-vuejs/
mv mrxgrid adeo-grid-monorepo
cd adeo-grid-monorepo
git remote set-url origin https://github.com/Maksnaga/adeo-grid-monorepo.git
git fetch origin
```

### 4.2 Créer les répertoires de base

```bash
mkdir -p apps packages .changeset .github/workflows
```

### 4.3 `package.json` racine (workspace)

Remplacer le `package.json` actuel par :

```json
{
  "name": "adeo-grid-monorepo",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": "^20.19.0 || >=22.12.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "build:vue": "pnpm --filter @adeo/grid-vue build",
    "build:angular": "pnpm --filter @adeo/grid-angular build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "storybook": "turbo run storybook",
    "storybook:vue": "pnpm --filter @adeo/grid-vue storybook",
    "storybook:angular": "pnpm --filter @adeo/grid-angular storybook",
    "storybook:portal": "pnpm --filter @adeo/storybook-portal storybook",
    "dev": "turbo run dev",
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

> ⚠️ **Important** : le `package.json` actuel de `mrxgrid` a déjà toutes les dépendances Vue. **Ne les copie pas dans le root** — elles iront dans `apps/grid-vue/package.json` après le déplacement Phase 2.

### 4.4 `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 4.5 `turbo.json`

Reprendre la config de `MONOREPO-SETUP.md` §3.4 :

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", "tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json", "package.json", "vite.config.*", "angular.json", "ng-package.json"],
      "outputs": ["dist/**", "build/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/**", "vitest.config.*", "karma.conf.*"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*", "eslint.config.*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
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
    "clean": { "cache": false }
  }
}
```

### 4.6 `tsconfig.base.json`

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
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@adeo/spec": ["./packages/spec/src/index.ts"],
      "@adeo/spec/*": ["./packages/spec/src/*"]
    }
  }
}
```

### 4.7 `.gitignore` racine

Ajouter au `.gitignore` actuel :

```
.turbo/
apps/*/node_modules/
apps/*/dist/
apps/*/storybook-static/
packages/*/node_modules/
packages/*/dist/
```

### 4.8 Commit du skeleton

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore apps/ packages/
git commit -m "chore(monorepo): bootstrap pnpm workspaces + turbo skeleton"
```

---

## 5. Phase 2 — Déplacer le contenu actuel dans `apps/grid-vue/`

### 5.1 Déplacement physique

⚠️ **Faire ce déplacement attentivement** — c'est un gros mv et il faut surveiller les chemins.

```bash
mkdir -p apps/grid-vue

# Déplace tout sauf les nouveaux fichiers racine + .git + apps/ + packages/
git mv \
  src \
  package.json \
  pnpm-lock.yaml \
  vite.config.ts \
  tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.vitest.json \
  vitest.config.ts \
  index.html \
  public \
  e2e playwright.config.ts \
  .storybook \
  README.md \
  scripts \
  deploy \
  cspell.json \
  .eslintrc.cjs .prettierrc.json \
  apps/grid-vue/
```

> ⚠️ **Note** : `git mv` peut nécessiter d'être fait en plusieurs étapes selon ta version de git. Si certains fichiers ne sont pas tracked, utilise `mv` à la place + `git add apps/grid-vue/` ensuite.

### 5.2 Renommer le package Vue

Éditer `apps/grid-vue/package.json` :

```json
{
  "name": "@adeo/grid-vue",
  "version": "0.0.1",
  "private": true,
  // ... reste inchangé
}
```

### 5.3 Adapter les paths internes éventuels

- Vérifier `apps/grid-vue/vite.config.ts` : si des paths `__dirname`-relatifs cassent, les fixer.
- Vérifier `apps/grid-vue/.storybook/main.ts` : pareil.
- Vérifier les scripts dans `apps/grid-vue/scripts/` (les CSV auditors, css-audit, etc.) : les chemins `process.cwd()` peuvent changer.

### 5.4 Documentation à déplacer dans `packages/docs/`

```bash
mkdir -p packages/docs
git mv apps/grid-vue/docs packages/docs/grid-vue-docs
# Mais garde MONOREPO-SETUP.md, plan.md, vue-vs-angular-sync.md dans packages/docs/ à la racine
```

### 5.5 Test que la lib Vue compile encore

```bash
cd apps/grid-vue
pnpm install
pnpm run build
# Build vert → OK
cd ../..
git add .
git commit -m "chore(monorepo): move repo content into apps/grid-vue"
```

---

## 6. Phase 3 — Extraire le grid Angular depuis `mozaic-angular`

### 6.1 Identifier les fichiers à extraire

Côté `mozaic-angular`, la lib grid vit dans :
```
mozaic-angular/projects/mozaic-ng/src/lib/grid/
```

C'est ce dossier qu'on extrait. Mais il a aussi besoin :
- D'un `public-api.ts` qui re-export tout
- D'un `package.json` qui déclare `@adeo/grid-angular`
- D'un `ng-package.json` qui dit à `ng-packagr` comment builder
- D'un `tsconfig.lib.json` et `tsconfig.lib.prod.json`
- D'un `angular.json` minimal pour driver `ng build`
- D'un setup Storybook (cf. `mozaic-angular/.storybook/`)

### 6.2 Création de la structure

```bash
mkdir -p apps/grid-angular/projects/grid-angular/src/lib
mkdir -p apps/grid-angular/.storybook

cp -r ~/Documents/GitHub/mozaic-angular/projects/mozaic-ng/src/lib/grid \
      apps/grid-angular/projects/grid-angular/src/lib/grid

# Copier aussi les stories du grid uniquement
cp -r ~/Documents/GitHub/mozaic-angular/projects/mozaic-ng/src/lib/grid/stories \
      apps/grid-angular/projects/grid-angular/src/stories 2>/dev/null || true
```

### 6.3 Créer `public-api.ts`

`apps/grid-angular/projects/grid-angular/src/public-api.ts` :

```ts
// Re-export everything the grid public API needs.
// Mirrors mozaic-angular/projects/mozaic-ng/src/public-api.ts (grid section).
export * from './lib/grid';
```

### 6.4 `package.json` de `apps/grid-angular/`

```json
{
  "name": "@adeo/grid-angular",
  "version": "0.0.1",
  "private": false,
  "description": "Adeo Grid — Angular implementation",
  "scripts": {
    "build": "ng build grid-angular",
    "test": "ng test grid-angular --watch=false",
    "storybook": "storybook dev -p 6007 --no-open",
    "storybook-build": "storybook build -o storybook-static",
    "lint": "ng lint grid-angular",
    "clean": "rm -rf dist storybook-static .angular"
  },
  "dependencies": {
    "@angular/animations": "^21.0.0",
    "@angular/cdk": "^21.0.0",
    "@angular/common": "^21.0.0",
    "@angular/core": "^21.0.0",
    "@angular/forms": "^21.0.0",
    "@angular/platform-browser": "^21.0.0",
    "@angular/platform-browser-dynamic": "^21.0.0",
    "rxjs": "^7.8.0",
    "tslib": "^2.6.0",
    "zone.js": "~0.14.0"
  },
  "peerDependencies": {
    "@mozaic-ds/angular": "^21.0.0 || ^22.0.0",
    "@mozaic-ds/icons-angular": "^2.0.0",
    "@mozaic-ds/styles": "^11.0.0",
    "@mozaic-ds/tokens": "^11.0.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^21.0.0",
    "@angular/cli": "^21.0.0",
    "@angular/compiler-cli": "^21.0.0",
    "@storybook/angular": "^10.0.0",
    "@analogjs/storybook-angular": "latest",
    "@compodoc/compodoc": "^1.1.0",
    "ng-packagr": "^21.0.0",
    "typescript": "~5.6.3"
  }
}
```

> ⚠️ **Adapte les versions** selon ce qu'utilise `mozaic-angular/package.json` actuellement. Lis-le pour copier les versions exactes : `cat ~/Documents/GitHub/mozaic-angular/package.json`.

### 6.5 `ng-package.json`

`apps/grid-angular/projects/grid-angular/ng-package.json` :

```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/grid-angular",
  "lib": {
    "entryFile": "src/public-api.ts"
  }
}
```

### 6.6 `tsconfig.lib.json`

`apps/grid-angular/projects/grid-angular/tsconfig.lib.json` :

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/lib",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": []
  },
  "exclude": [
    "**/*.spec.ts",
    "**/*.stories.ts"
  ]
}
```

### 6.7 `tsconfig.json` racine `apps/grid-angular/`

```json
{
  "extends": "../../tsconfig.base.json",
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "outDir": "./dist/out-tsc",
    "experimentalDecorators": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022",
    "useDefineForClassFields": false,
    "lib": ["ES2022", "dom"]
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

### 6.8 `angular.json`

`apps/grid-angular/angular.json` :

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "grid-angular": {
      "projectType": "library",
      "root": "projects/grid-angular",
      "sourceRoot": "projects/grid-angular/src",
      "prefix": "moz",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:ng-packagr",
          "options": {
            "project": "projects/grid-angular/ng-package.json"
          },
          "configurations": {
            "production": {
              "tsConfig": "projects/grid-angular/tsconfig.lib.prod.json"
            },
            "development": {
              "tsConfig": "projects/grid-angular/tsconfig.lib.json"
            }
          },
          "defaultConfiguration": "production"
        }
      }
    }
  }
}
```

### 6.9 Copier la config Storybook depuis mozaic-angular

```bash
cp -r ~/Documents/GitHub/mozaic-angular/.storybook apps/grid-angular/.storybook
```

Adapter `apps/grid-angular/.storybook/main.ts` :
- Modifier `stories: ['../projects/grid-angular/src/**/*.stories.@(ts|mdx)']`
- Vérifier que le `viteFinal` et les addons restent corrects.

### 6.10 Commit

```bash
git add apps/grid-angular/
git commit -m "feat(monorepo): extract grid lib from mozaic-angular into apps/grid-angular"
```

---

## 7. Phase 4 — Transformer les imports Angular relatifs

### 7.1 Le problème

Dans `mozaic-angular/projects/mozaic-ng/src/lib/grid/`, beaucoup de fichiers utilisent des imports relatifs vers d'autres composants Mozaic :

```ts
import { MozTagComponent } from '../../tag/tag';
import { MozSelectComponent } from '../../select/select';
import { MozCheckboxComponent } from '../../checkbox/checkbox';
import { MozDatepickerComponent } from '../../datepicker/datepicker';
import { MozComboboxComponent } from '../../combobox';
import { MozTooltipDirective } from '../../tooltip/tooltip.directive';
import { MozButtonComponent } from '../../button/button';
import { MozActionListItem } from '../../action-listbox/...';
import { MozDrawerService } from '../../drawer/...';
// etc.
```

Après extraction dans `apps/grid-angular/projects/grid-angular/src/lib/grid/`, ces chemins `../../tag/tag` ne pointent **plus vers rien** — il faut les transformer en imports depuis `@mozaic-ds/angular`.

### 7.2 Audit des imports relatifs

```bash
cd apps/grid-angular/projects/grid-angular/src/lib/grid
grep -rn "from '\.\./\.\./" --include='*.ts' --include='*.html' | head -30
```

Tu vas voir une liste comme :
```
features/something.ts:5:import { MozTagComponent } from '../../tag/tag';
components/cell/grid-cell.ts:10:import { MozSelectComponent } from '../../select/select';
...
```

### 7.3 Script de transform

Crée un script `tools/migrate-mozaic-imports.sh` à la racine du monorepo :

```bash
#!/usr/bin/env bash
set -euo pipefail

GRID_DIR="apps/grid-angular/projects/grid-angular/src/lib/grid"

# Map each `../../X/X` pattern to its public symbol in @mozaic-ds/angular.
# All Mozaic components are barrel-exported from the package root.

# Common patterns (extend as needed):
declare -A MAP=(
  ["'../../tag/tag'"]="'@mozaic-ds/angular'"
  ["'../../select/select'"]="'@mozaic-ds/angular'"
  ["'../../select'"]="'@mozaic-ds/angular'"
  ["'../../checkbox/checkbox'"]="'@mozaic-ds/angular'"
  ["'../../datepicker/datepicker'"]="'@mozaic-ds/angular'"
  ["'../../combobox'"]="'@mozaic-ds/angular'"
  ["'../../combobox/combobox.model'"]="'@mozaic-ds/angular'"
  ["'../../tooltip/tooltip.directive'"]="'@mozaic-ds/angular'"
  ["'../../button/button'"]="'@mozaic-ds/angular'"
  ["'../../action-listbox/action-listbox-trigger.directive'"]="'@mozaic-ds/angular'"
  ["'../../action-listbox/action-listbox.model'"]="'@mozaic-ds/angular'"
  ["'../../drawer/drawer.service'"]="'@mozaic-ds/angular'"
  ["'../../drawer/drawer-data.token'"]="'@mozaic-ds/angular'"
  ["'../../tag/tag.model'"]="'@mozaic-ds/angular'"
)

for old in "${!MAP[@]}"; do
  new="${MAP[$old]}"
  # Use grep+sed; fall back to true if no match
  grep -rl "$old" "$GRID_DIR" --include='*.ts' --include='*.html' 2>/dev/null \
    | xargs -I {} sed -i "s|$old|$new|g" {} \
    || true
done

echo "✅ Imports migrés. Vérifie avec:"
echo "  grep -rn \"from '\\.\\./\\.\\./\" $GRID_DIR --include='*.ts' --include='*.html'"
```

```bash
chmod +x tools/migrate-mozaic-imports.sh
./tools/migrate-mozaic-imports.sh
```

### 7.4 Audit post-transform

```bash
grep -rn "from '\.\./\.\./" apps/grid-angular/projects/grid-angular/src/lib/grid \
  --include='*.ts' --include='*.html'
```

Si le grep retourne **0 résultat** → tous les imports relatifs vers les autres composants Mozaic sont migrés.

Si certains restent (ex: imports relatifs à l'intérieur du grid lui-même comme `'../../models/column.model'`) → c'est OK, on les garde. Ils restent internes au grid.

### 7.5 Vérifier que les symboles existent bien dans `@mozaic-ds/angular`

```bash
# Vérifie le public-api de la version npm de mozaic-angular
grep -E "^export" ~/Documents/GitHub/mozaic-angular/projects/mozaic-ng/src/public-api.ts | head -30
```

Pour chaque symbole utilisé dans le grid (MozTagComponent, MozSelectComponent, etc.), confirme qu'il est dans le public-api. Si non → le composant n'est pas public, soit on le rend public côté mozaic-angular (PR upstream), soit on copie ce composant aussi dans `apps/grid-angular/` (le fork s'élargit).

### 7.6 Install + build test

```bash
cd apps/grid-angular
pnpm install
pnpm run build
```

→ si le build passe : 🎉

→ si erreurs : typiquement des imports manqués (le script ne couvre que les patterns connus). Repère, ajoute au map du script, re-run.

```bash
cd ../..
git add tools/ apps/grid-angular/
git commit -m "refactor(grid-angular): migrate relative Mozaic imports to @mozaic-ds/angular"
```

---

## 8. Phase 5 — Setup pnpm workspaces + Turborepo + Storybook Composition

### 8.1 Install pnpm à la racine

```bash
# Racine du monorepo
pnpm install
```

Cela installe les deps des 2 apps + crée le `pnpm-lock.yaml` racine. Le `node_modules/` racine contient les deps hoissées + des symlinks vers `apps/*/node_modules/`.

### 8.2 Test Turbo sur les 2 apps

```bash
pnpm turbo run build
```

Turbo build les 2 apps en parallèle. Avec cache local activé, la 2e exécution est instantanée.

### 8.3 Storybook Portal — `apps/storybook-portal/`

```bash
mkdir -p apps/storybook-portal/.storybook
mkdir -p apps/storybook-portal/stories
```

`apps/storybook-portal/package.json` :

```json
{
  "name": "@adeo/storybook-portal",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "storybook": "storybook dev -p 6008 --no-open",
    "storybook-build": "storybook build -o storybook-static"
  },
  "devDependencies": {
    "@storybook/html": "^10.0.0",
    "@storybook/html-vite": "^10.0.0",
    "@storybook/addon-essentials": "^10.0.0",
    "@storybook/addon-links": "^10.0.0",
    "storybook": "^10.0.0",
    "vite": "^5.0.0"
  }
}
```

`apps/storybook-portal/.storybook/main.ts` :

```ts
import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|ts)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-links'],
  framework: '@storybook/html-vite',
  refs: {
    'grid-vue': {
      title: 'Grid (Vue)',
      url: process.env.NODE_ENV === 'production'
        ? '/storybook/grid-vue'
        : 'http://localhost:6006',
      expanded: false,
    },
    'grid-angular': {
      title: 'Grid (Angular)',
      url: process.env.NODE_ENV === 'production'
        ? '/storybook/grid-angular'
        : 'http://localhost:6007',
      expanded: false,
    },
  },
};

export default config;
```

`apps/storybook-portal/.storybook/preview.ts` :

```ts
import type { Preview } from '@storybook/html';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;
```

### 8.4 Stories transverses dans `apps/storybook-portal/stories/`

Créer des MDX d'intro qui pointent vers la spec :

```mdx
{/* apps/storybook-portal/stories/00-welcome.mdx */}
import { Meta } from '@storybook/blocks';

<Meta title="Welcome" />

# Adeo Grid — Spec mutualisée

Documentation framework-agnostique du datagrid Adeo.

- **Grid (Vue)** ← lib Vue 3, voir le Sidebar.
- **Grid (Angular)** ← lib Angular, voir le Sidebar.

## Liens

- [Spec chapitres](/packages/spec/)
- [Plan d'exécution monorepo](/packages/docs/turborepo-execution-plan.md)
```

### 8.5 Run les 3 Storybooks en parallèle pour dev local

Dans 3 terminaux :

```bash
# Terminal 1
pnpm storybook:vue
# → http://localhost:6006

# Terminal 2
pnpm storybook:angular
# → http://localhost:6007

# Terminal 3
pnpm storybook:portal
# → http://localhost:6008 (composé)
```

Ouvrir `http://localhost:6008` → tu vois le portail qui agrège les 2 autres via les refs.

> Pour la prod, après les `storybook-build` des 3, déployer `storybook-portal/storybook-static/` + copier `apps/grid-vue/storybook-static/` dans `storybook-portal/storybook-static/grid-vue/` et `apps/grid-angular/storybook-static/` dans `storybook-portal/storybook-static/grid-angular/`. Voir `MONOREPO-SETUP.md` §7 pour les détails de routing nginx.

### 8.6 Commit

```bash
git add apps/storybook-portal/ tools/
git commit -m "feat(monorepo): add storybook-portal aggregator with refs to grid-vue + grid-angular"
```

---

## 9. Phase 6 — CI/CD GitHub Actions

`.github/workflows/ci.yml` :

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      - uses: actions/setup-node@v4
        with: { node-version: 22 }

      - run: corepack enable
      - run: pnpm install --frozen-lockfile

      # Cache Turbo
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: turbo-${{ runner.os }}-

      - run: pnpm turbo run build test lint
```

`.github/workflows/release.yml` (manuel ou tag-triggered) :

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions: { contents: write, pull-requests: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build

      - uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

```bash
git add .github/
git commit -m "ci: turborepo + changesets workflows"
```

---

## 10. Phase 7 — Versioning et release

### 10.1 Init Changesets

```bash
pnpm changeset init
```

Cela crée `.changeset/config.json`. Éditer pour autoriser le scope `@adeo/*` :

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@adeo/storybook-portal"]
}
```

### 10.2 Workflow de version

```bash
# Tu fais une modif dans apps/grid-vue
pnpm changeset
# → interactif : sélectionne @adeo/grid-vue, type patch/minor/major, décris

# Quand tu veux release
pnpm version    # met à jour les versions + changelog
pnpm release    # build + publish
```

---

## 11. Validation finale et runbook quotidien

### 11.1 Sanity check post-migration

```bash
# Tout build
pnpm turbo run build
# → 2 succès (grid-vue + grid-angular)

# Tout test
pnpm turbo run test

# Storybook démarre
pnpm storybook:vue       # localhost:6006
pnpm storybook:angular   # localhost:6007
pnpm storybook:portal    # localhost:6008 (composition)
```

### 11.2 Runbook quotidien

| Action | Commande |
|---|---|
| Démarrer la demo Vue | `pnpm --filter @adeo/grid-vue dev` |
| Démarrer Storybook Vue | `pnpm storybook:vue` |
| Démarrer Storybook Angular | `pnpm storybook:angular` |
| Démarrer le portail | `pnpm storybook:portal` |
| Build d'une lib | `pnpm --filter @adeo/grid-vue build` |
| Tous les builds | `pnpm build` |
| Tous les tests | `pnpm test` |
| Nettoyer | `pnpm clean` |
| Add changeset | `pnpm changeset` |
| Release | `pnpm release` |

### 11.3 Git commits finaux

```bash
git add -A
git commit -m "chore(monorepo): final monorepo turborepo + storybook composition setup"
git push origin feat/turborepo-monorepo
```

Crée la PR → review → merge sur `main` → CI passe → release.

---

## 12. Pièges connus et solutions

### 12.1 Imports relatifs résiduels après Phase 4

Si le build Angular crash sur des `Cannot find module '../../X'` après la migration imports : c'est qu'un pattern n'est pas dans le map du script. Ajoute-le, re-run.

### 12.2 Versions Angular qui divergent

Si `mozaic-angular` upstream bump Angular 22 et que ton fork est en 21, le grid peut commencer à utiliser des features 22-only. Soit tu suis (bump aussi), soit tu freeze le grid à 21.

### 12.3 Conflits HMR pendant le développement

Si tu modifies un fichier dans `apps/grid-vue/src/components/Grid/` pendant que `pnpm storybook:vue` tourne, ça doit hot-reload. Si ça ne marche pas : `vite.config.ts` peut nécessiter `server.watch.ignored: ['!**/node_modules/@adeo/**']` pour autoriser le watch des workspace deps.

### 12.4 pnpm-lock.yaml et CI

Le lockfile racine est partagé entre tous les workspaces. **Ne le commit qu'avec `--frozen-lockfile` côté CI**. Si la CI échoue avec "lockfile out of date", c'est que tu as oublié un `pnpm install` après modif d'un `package.json`.

### 12.5 Storybook composition en production

Le routing CDN/nginx doit redirigier :
- `/` → `storybook-portal/storybook-static/`
- `/grid-vue/*` → `grid-vue/storybook-static/`
- `/grid-angular/*` → `grid-angular/storybook-static/`

Avec les `refs.url` dans le portail réglés à ces chemins relatifs (`/grid-vue`, `/grid-angular`).

---

## 13. Timeline estimative

| Phase | Durée estimée |
|---|---|
| Phase 0 (snapshot+branche) | 10 min |
| Phase 1 (renommage+skeleton) | 30 min |
| Phase 2 (déplacement Vue) | 1-2h (tests inclus) |
| Phase 3 (extraction Angular) | 2-3h |
| Phase 4 (migration imports) | 1-2h (selon nombre d'erreurs) |
| Phase 5 (pnpm+turbo+portal) | 1-2h |
| Phase 6 (CI/CD) | 30 min |
| Phase 7 (Changesets) | 30 min |
| **Total** | **~1 journée de travail focalisé** |

---

*Fin du plan. Ce document complète `MONOREPO-SETUP.md` (qui présentait l'approche générale) en fournissant un runbook concret adapté au scénario "in-place restructure + extraction Angular".*
