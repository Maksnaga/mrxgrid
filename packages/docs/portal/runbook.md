# Runbook quotidien

Référence rapide pour les commandes courantes du monorepo.

## Développement

| Action | Commande |
|---|---|
| Lancer tous les Storybooks | `pnpm storybook` |
| Storybook Vue uniquement | `pnpm storybook:vue` |
| Storybook Angular uniquement | `pnpm storybook:angular` |
| Storybook portail uniquement | `pnpm storybook:portal` |
| Dev server Vue (Vite) | `pnpm --filter @adeo/grid-vue dev` |

## Build

| Action | Commande |
|---|---|
| Build tous les packages | `pnpm build` |
| Build Vue uniquement | `pnpm build:vue` |
| Build Angular uniquement | `pnpm build:angular` |
| Build Storybook portail | `pnpm --filter @adeo/storybook-portal storybook-build` |

## Tests

| Action | Commande |
|---|---|
| Tous les tests | `pnpm test` |
| Tests unitaires Vue | `pnpm --filter @adeo/grid-vue test:unit` |
| Tests E2E Vue | `pnpm --filter @adeo/grid-vue test:e2e` |
| Tests Angular | `pnpm --filter @adeo/grid-angular test` |

## Qualité

| Action | Commande |
|---|---|
| Lint tout | `pnpm lint` |
| Format tout | `pnpm format` |
| Type-check Vue | `pnpm --filter @adeo/grid-vue exec npx vue-tsc --build` |

## Releases (Changesets)

| Action | Commande |
|---|---|
| Créer un changeset | `pnpm changeset` |
| Bumper les versions | `pnpm version` |
| Publier | `pnpm release` |

## Turborepo — cache

```bash
# Vider le cache local Turborepo
pnpm exec turbo daemon stop
rm -rf .turbo

# Forcer un build sans cache
pnpm build -- --force
```

## Ajout d'une dépendance

```bash
# Dans grid-vue uniquement
pnpm --filter @adeo/grid-vue add <package>

# Dans grid-angular uniquement
pnpm --filter @adeo/grid-angular add <package>

# Dans le portail
pnpm --filter @adeo/storybook-portal add -D <package>
```
