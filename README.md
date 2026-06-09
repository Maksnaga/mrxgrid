# Adeo Grid Monorepo

> **Status** : Bootstrap monorepo en cours — branche `feat/turborepo-monorepo`

Deux implémentations framework du même datagrid haute performance conçu pour l'écosystème ADEO :

| Package | Framework | Storybook |
|---|---|---|
| `@adeo/grid-vue` | Vue 3 + TypeScript | `localhost:6006` |
| `@adeo/grid-angular` | Angular 21 + Signals | `localhost:6007` |
| `@adeo/storybook-portal` | Composition (agrégateur) | `localhost:6008` |

Les deux libs exposent la même surface fonctionnelle : virtual scroll dual-axe, sort/filter/grouping, cell editing, formulas, export, plugins, etc.

---

## Structure

```
adeo-grid-monorepo/
├── .changeset/                       # versioning Changesets
├── .github/workflows/                # CI GitHub Actions
├── .turbo/                           # cache local Turbo (gitignored)
├── apps/
│   ├── grid-vue/                     # lib Vue + demo + Storybook
│   │   ├── src/components/AdeoGrid/
│   │   ├── src/app/                  # demo + renderers consumer
│   │   ├── .storybook/
│   │   ├── vite.config.ts
│   │   └── package.json              # @adeo/grid-vue
│   ├── grid-angular/                 # grid extrait de mozaic-angular
│   │   ├── src/lib/grid/             # lib elle-même
│   │   ├── src/public-api.ts
│   │   ├── .storybook/
│   │   ├── ng-package.json
│   │   ├── angular.json
│   │   └── package.json              # @adeo/grid-angular
│   └── storybook-portal/             # agrégateur Storybook Composition
│       ├── .storybook/main.ts        # refs vers grid-vue + grid-angular
│       ├── stories/                  # doc transverse
│       └── package.json
├── packages/
│   ├── spec/                         # @adeo/spec — chapitres .md mutualisés
│   └── docs/                         # turborepo-execution-plan.md, MONOREPO-SETUP.md,
│                                     # grid-vue-docs/, vue-vs-angular-sync.md
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── package.json                      # workspace root
└── README.md
```

---

## Démarrage rapide

```bash
# Prérequis
node --version    # >=20.19 ou >=22.12
corepack enable
pnpm --version    # >=9.0

# Install toutes les deps du workspace
pnpm install

# Demo Vue
pnpm --filter @adeo/grid-vue dev

# Storybooks
pnpm storybook:vue       # http://localhost:6006
pnpm storybook:angular   # http://localhost:6007
pnpm storybook:portal    # http://localhost:6008 (composition)
```

---

## Runbook quotidien

| Action | Commande |
|---|---|
| Démarrer la demo Vue | `pnpm --filter @adeo/grid-vue dev` |
| Storybook Vue | `pnpm storybook:vue` |
| Storybook Angular | `pnpm storybook:angular` |
| Portail Storybook (composition) | `pnpm storybook:portal` |
| Build d'une lib | `pnpm --filter @adeo/grid-vue build` |
| Tous les builds | `pnpm build` |
| Tous les tests | `pnpm test` |
| Lint global | `pnpm lint` |
| Nettoyer caches + dist | `pnpm clean` |
| Ajouter un changeset | `pnpm changeset` |
| Bumper les versions | `pnpm version` |
| Publier sur npm | `pnpm release` |

---

## CI / Release

**CI** (`.github/workflows/ci.yml`) : déclenché sur push `main` + toute PR.
Pipeline : `checkout → setup-node 22 → corepack enable → pnpm install --frozen-lockfile → turbo build test lint`.

**Release** (`.github/workflows/release.yml`) : déclenché sur push `main` via Changesets.
Pipeline : build → `changesets/action` → bump versions → publish npm.

Secrets GitHub à configurer dans `Settings → Secrets and variables → Actions` :
- `NPM_TOKEN` — token npm avec permission `publish` sur le scope `@adeo`
- `GITHUB_TOKEN` — fourni automatiquement par GitHub Actions (pas besoin de le créer)

---

## Workflow de contribution

1. Crée une branche feature
2. Modifie une lib publiable (`apps/grid-vue/` ou `apps/grid-angular/`)
3. Ajoute un changeset : `pnpm changeset` (sélectionne le package, bump type, description)
4. Commit + push + ouvre une PR
5. La CI vérifie build + test + lint
6. Après merge sur `main`, Changesets ouvre automatiquement une PR "Version Packages"
7. Merge la PR de version → déclenche le publish npm

---

## Documentation

- [Plan d'exécution monorepo](packages/docs/grid-vue-docs/turborepo-execution-plan.md)
- [Guide setup monorepo](apps/grid-vue/MONOREPO-SETUP.md)
- [Parity Vue vs Angular](packages/docs/grid-vue-docs/vue-vs-angular-sync.md)
- [Runbook étendu](packages/docs/runbook.md)
