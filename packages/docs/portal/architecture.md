# Architecture monorepo

Ce portail est la troisième application du monorepo `adeo-grid-monorepo`.

## Structure

```
adeo-grid-monorepo/
├── apps/
│   ├── grid-vue/          — Grid Vue 3 + Storybook (port 6006)
│   ├── grid-angular/      — ad-grid Angular 21 + Storybook (port 6007)
│   └── storybook-portal/  — Ce portail (port 6008, composition via refs)
├── packages/
│   └── docs/              — Documentation partagée (MDX, specs)
├── turbo.json             — Pipeline Turborepo
└── pnpm-workspace.yaml    — Workspace pnpm
```

## Storybook Composition

Le portail utilise la fonctionnalité **refs** de Storybook pour agréger les deux Storybooks framework-spécifiques dans une seule interface :

| Ref key | Titre | Dev URL | Prod URL |
|---|---|---|---|
| `grid-vue` | Grid (Vue) | `http://localhost:6006` | `/storybook/grid-vue` |
| `grid-angular` | Grid (Angular) | `http://localhost:6007` | `/storybook/grid-angular` |

En développement, lance les trois Storybooks en parallèle :

```bash
# Terminal 1
pnpm --filter @adeo/grid-vue storybook

# Terminal 2
pnpm --filter @adeo/grid-angular storybook

# Terminal 3 (le portail)
pnpm --filter @adeo/storybook-portal storybook
```

Ou via Turborepo (les trois en une commande) :

```bash
pnpm storybook
```

## Référence

Voir `MONOREPO-SETUP.md` dans `apps/grid-vue/` pour le guide complet de setup, déploiement et contributions.
