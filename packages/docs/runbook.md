# Runbook — Adeo Grid Monorepo

> Guide opérationnel quotidien, workflows de release, et troubleshooting.

---

## 1. Commandes quotidiennes

### 1.1 Setup initial

```bash
node --version    # >=20.19 ou >=22.12
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install      # installe toutes les deps du workspace
```

### 1.2 Développement

| Action | Commande |
|---|---|
| Demo Vue (Vite dev server) | `pnpm --filter @adeo/grid-vue dev` |
| Storybook Vue | `pnpm storybook:vue` ou `pnpm --filter @adeo/grid-vue storybook` |
| Storybook Angular | `pnpm storybook:angular` ou `pnpm --filter @adeo/grid-angular storybook` |
| Portail Storybook (composition) | `pnpm storybook:portal` ou `pnpm --filter @adeo/storybook-portal storybook` |
| 3 Storybooks en parallèle | Ouvrir 3 terminaux + lancer chacun |

### 1.3 Build

| Action | Commande |
|---|---|
| Build toutes les libs | `pnpm build` (via turbo, parallèle) |
| Build lib Vue seulement | `pnpm build:vue` |
| Build lib Angular seulement | `pnpm build:angular` |
| Build Storybook Vue (static) | `pnpm --filter @adeo/grid-vue storybook-build` |
| Build Storybook Angular (static) | `pnpm --filter @adeo/grid-angular storybook-build` |
| Build portail Storybook | `pnpm --filter @adeo/storybook-portal storybook-build` |

### 1.4 Tests

| Action | Commande |
|---|---|
| Tous les tests | `pnpm test` |
| Tests Vue seulement | `pnpm --filter @adeo/grid-vue test` |
| Tests Vue — fichier unique | `cd apps/grid-vue && npx vitest run src/__tests__/MyTest.spec.ts` |
| Tests Angular seulement | `pnpm --filter @adeo/grid-angular test` |
| Tests E2E Vue | `pnpm --filter @adeo/grid-vue test:e2e` |

### 1.5 Lint + Format

| Action | Commande |
|---|---|
| Lint global | `pnpm lint` |
| Lint Vue seulement | `pnpm --filter @adeo/grid-vue lint` |
| Lint Angular seulement | `pnpm --filter @adeo/grid-angular lint` |
| Format (Prettier) | `pnpm format` |

### 1.6 Nettoyage

| Action | Commande |
|---|---|
| Clean caches + dist | `pnpm clean` |
| Clean node_modules racine | `rm -rf node_modules .turbo` |
| Clean tout (hard reset) | `pnpm clean && rm -rf node_modules apps/*/node_modules packages/*/node_modules` |

---

## 2. Workflows de release

### 2.1 Release standard (via Changesets + CI)

```bash
# 1. Sur ta branche feature, après ta modif
pnpm changeset
# → interactif : sélectionne @adeo/grid-vue et/ou @adeo/grid-angular
# → choisis le type de bump : patch / minor / major
# → décris le changement en une phrase
# Un fichier .md est créé dans .changeset/

# 2. Commit le changeset avec la PR
git add .changeset/
git commit -m "chore: add changeset for <description>"
git push

# 3. La PR est mergée sur main
# → Changesets CI ouvre automatiquement une PR "Version Packages"
# → Cette PR bumpe les versions dans package.json + met à jour CHANGELOG.md

# 4. Merge la PR "Version Packages"
# → Déclenche le workflow release.yml
# → build → publish npm
```

### 2.2 Release manuelle (urgence)

```bash
# Depuis main, localement
pnpm version     # consomme les .md de .changeset/ + bump les versions
pnpm release     # turbo build + changeset publish
```

### 2.3 Pré-release / beta

```bash
# Entrer en mode pre-release
pnpm changeset pre enter beta

# Ajouter des changesets normalement
pnpm changeset

# Version + publish en beta
pnpm version
pnpm release
# → publie @adeo/grid-vue@1.2.0-beta.0

# Sortir du mode pre-release
pnpm changeset pre exit
```

### 2.4 Secrets GitHub requis

Configurer dans `GitHub repo → Settings → Secrets and variables → Actions` :

| Secret | Description | Comment l'obtenir |
|---|---|---|
| `NPM_TOKEN` | Token npm avec droit `publish` sur `@adeo/*` | `npm token create --access=public` |
| `GITHUB_TOKEN` | Fourni automatiquement par GitHub | Rien à faire |

---

## 3. Troubleshooting

### 3.1 Imports relatifs résiduels après extraction Angular

**Symptôme** : le build Angular crash sur `Cannot find module '../../tag/tag'`.

**Cause** : le script `tools/migrate-mozaic-imports.sh` ne couvre pas tous les patterns.

**Fix** :
```bash
# Audit des imports non migrés
grep -rn "from '\.\./\.\./" apps/grid-angular/projects/grid-angular/src/lib/grid \
  --include='*.ts' --include='*.html'

# Ajouter le pattern manquant dans tools/migrate-mozaic-imports.sh
# puis re-run
./tools/migrate-mozaic-imports.sh
```

### 3.2 pnpm-lock.yaml obsolète en CI

**Symptôme** : CI échoue avec `ERR_PNPM_OUTDATED_LOCKFILE`.

**Cause** : un `package.json` a été modifié sans relancer `pnpm install`.

**Fix** :
```bash
pnpm install       # met à jour le lockfile
git add pnpm-lock.yaml
git commit -m "chore: update pnpm lockfile"
```

### 3.3 Versions Angular qui divergent

**Symptôme** : `mozaic-angular` upstream bump Angular 22, le grid reste en 21.

**Options** :
- Suivre le bump : mettre à jour `apps/grid-angular/package.json` + `pnpm install`
- Freezer à 21 : garder la version actuelle, ignorer les upstream bumps (acceptable à court terme)

### 3.4 HMR (hot-reload) ne fonctionne pas sur les workspace deps

**Symptôme** : modifier un fichier dans `apps/grid-vue/` ne déclenche pas de hot-reload si la lib est consommée comme package workspace.

**Fix** dans `apps/grid-vue/vite.config.ts` :
```ts
server: {
  watch: {
    ignored: ['!**/node_modules/@adeo/**'],
  },
}
```

### 3.5 Storybook composition en production — erreur CORS

**Symptôme** : le portail Storybook charge mais les iframes `grid-vue` et `grid-angular` sont vides / erreur réseau.

**Cause** : les builds statiques ne sont pas servis aux bons chemins relatifs.

**Fix nginx** :
```nginx
location / {
  root /var/www/storybook-portal/storybook-static;
  try_files $uri $uri/ /index.html;
}
location /grid-vue/ {
  alias /var/www/storybook-portal/storybook-static/grid-vue/;
}
location /grid-angular/ {
  alias /var/www/storybook-portal/storybook-static/grid-angular/;
}
```

Les `refs.url` dans `.storybook/main.ts` du portail doivent correspondre à `/grid-vue` et `/grid-angular`.

### 3.6 Turbo cache invalide après changement de tsconfig.base.json

**Symptôme** : `turbo run build` utilise un cache obsolète après avoir modifié `tsconfig.base.json`.

**Cause** : `tsconfig.base.json` est déclaré dans `globalDependencies` de `turbo.json` — tout changement invalide le cache global.

**Fix** : c'est le comportement attendu. Le cache sera reconstruit à la prochaine exécution. Si besoin de forcer :
```bash
pnpm turbo run build --force
```

### 3.7 Le job release se déclenche même sans changeset

**Symptôme** : le workflow `release.yml` s'exécute sur chaque push `main` mais `changesets/action` ne publie rien (pas de changeset en attente).

**Comportement attendu** : c'est normal. `changesets/action` crée ou met à jour la PR "Version Packages" si des changesets sont présents, sinon ne fait rien. Pas d'effet secondaire.

### 3.8 `pnpm changeset` introuvable

**Symptôme** : `pnpm changeset` échoue avec `command not found`.

**Cause** : `@changesets/cli` n'est pas installé (ou `pnpm install` n'a pas été relancé).

**Fix** :
```bash
pnpm install
# @changesets/cli est dans les devDependencies du package.json racine
pnpm changeset
```

---

## 4. Structure des branches recommandée

| Branche | Usage |
|---|---|
| `main` | branche principale — CI + release |
| `feat/turborepo-monorepo` | branche de migration monorepo en cours |
| `feat/<nom>` | features et correctifs |
| `chore/<nom>` | maintenance, infra, docs |

---

## 5. Liens utiles

**Docs internes contributeur** (dans le repo, hors portail) :

- `packages/docs/grid-vue-docs/turborepo-execution-plan.md` — plan d'exécution monorepo
- `apps/grid-vue/MONOREPO-SETUP.md` — guide setup monorepo
- `packages/docs/grid-vue-docs/vue-vs-angular-sync.md` — parity Vue vs Angular

**Docs externes** :

- [Changesets documentation](https://github.com/changesets/changesets)
- [Turborepo documentation](https://turbo.build/repo/docs)
