# Tutoriel — Index

> Un parcours pas-à-pas du minimum vital au scénario "vrai PIM avec API serveur, sélection multi, bulk delete, export". Chaque chapitre est indépendant — saute celui qui te correspond pas.

## Pour qui

Devs Vue 3 (Composition API + `<script setup>`) ou Angular 21 (signals + standalone) qui découvrent `Grid` / `<ad-grid-angular>` et veulent intégrer un grid dans leur projet sans relire 3000 lignes de source.

## Quel chemin selon ton besoin

| Si tu veux…                                              | Va à                                                    |
|----------------------------------------------------------|---------------------------------------------------------|
| **Installer la lib** dans un projet vierge               | [Docs/Tutoriel/1 — Installation](?path=/docs/tutoriel-installation--docs)  |
| **Afficher 10 lignes hardcodées** triables et resizables | [Docs/Tutoriel/2 — Tableau simple](?path=/docs/tutoriel-tableau-simple--docs) |
| Aller plus loin : **58 cols × 424 rows**, renderers      | [Docs/Tutoriel/3 — Tableau complexe](?path=/docs/tutoriel-tableau-complexe--docs) |
| Brancher une **vraie API paginée**                       | [Docs/Tutoriel/4 — Fetch + pagination serveur](?path=/docs/tutoriel-fetch-pagination-serveur--docs) |

## Le scénario fil rouge

Du tuto 3 au tuto 4, on construit progressivement la même appli : un gestionnaire de catalogue PIM Adeo (papier peint INSPIRE). On ajoute une feature à chaque étape :

```
tuto 3   ► JSON statique, 58 cols, renderers Yes/No, formatters kg/cm
tuto 4   ► + API REST paginée, états loading/error/empty
```

À la fin du tuto 4, tu as une base prod-ready qui ressemble à la demo `Adeo PIM` du Storybook.

## Conventions de cette doc

- **Encarts Piège** — bugs / surprises qu'on a vécus en interne. Lis-les, ils valent leur poids en heures de debug évitées.
- **Encarts Note** — clarifications "pourquoi on fait comme ça".
- **TypeScript strict** dans tous les exemples.
- Chaque snippet est présenté en **Vue ET Angular** côte à côte. Choisis ta stack.

## Ce qui n'est PAS couvert

- **Tree mode** (parent / enfant hiérarchique) — voir [Docs/Tree, expand, colonnes, theming, perf, API](?path=/docs/theming-performance-api--docs).
- **Formula engine** (`=SUM(A1:A10)` dans les cellules) — feature spécialisée, doc dédiée à venir.
- **Server grouping** — fonctionne mais demande un contrat API spécifique. À documenter en V2.
- **Plugins** — voir le chapitre `Plugins` de la spec API.

## Premiers pas

Commence par le tuto 1 si tu n'as jamais installé la lib. Sinon va direct au tuto qui correspond à ton besoin — chaque tuto rappelle les concepts du précédent en intro.

[Tutoriel 1 — Installation](?path=/docs/tutoriel-installation--docs)
