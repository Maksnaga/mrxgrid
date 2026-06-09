# Changesets

Ajoute un changeset à chaque PR qui modifie une lib publiable :

```bash
pnpm changeset
```

Sélectionne le ou les packages affectés, choisis le type de bump (patch/minor/major), décris le changement. Un fichier `.md` sera créé dans ce dossier. Commit-le avec la PR.

Quand on veut release :

```bash
pnpm version  # consomme tous les .md du dossier et bump les versions
pnpm release  # build + publish sur npm
```
