# @adeo/grid — Spec mutualisée

> Version 1.0 — 2026-06-08
>
> Spec canonique du datagrid Adeo, framework-agnostic, avec mapping côté Vue (`@adeo/grid-vue`) et Angular (`@adeo/grid-angular`).
>
> Cette spec est la **source de vérité** sur ce que le grid fait. Les implémentations Vue et Angular convergent vers elle.

## Découpage

La spec est en 7 chapitres autonomes. Le contenu canonique vit dans le sous-dossier `packages/docs/grid-spec/`. Dans Storybook, navigue via la sidebar gauche → **Docs › Spec**.

| Chapitre | Couvre |
|---|---|
| **Introduction** | Philosophie, audience, architecture en 1 page, conventions |
| **Données & colonnes** | Modèle de données, définition des colonnes, pinning, virtualisation V+H |
| **Pipeline de données** | Tri, filtre, groupement, pagination (cascade de transformation) |
| **Interactions** | Sélection ligne et cellule, édition inline, validation, undo, presse-papier, clavier |
| **Extensibilité** | Renderers, plugins, formula engine, export, persistance d'état |
| **Theming, performance & API** | Tree, lignes dépliables, drag/reorder/resize/autosize/hide des colonnes, theming Mozaic, performance, API canonique |
| **Annexe** | Glossaire des termes, cross-ref avec sync.md, versioning, contribution |

## Lecture recommandée

| Tu veux... | Va à... |
|---|---|
| Comprendre l'architecture | Introduction |
| Le contrat d'une feature précise | Le chapitre qui contient cette feature (voir table ci-dessus) |
| La liste de toutes les props/events publics | Theming, performance & API — section « API canonique » |
| Le statut actuel des gaps Vue ↔ Angular | `vue-vs-angular-sync.md` (tracker opérationnel, hors spec) |
| Comprendre un terme technique | Annexe — section « Glossaire » |

## Statut v1.0

| Métrique | Valeur |
|---|---|
| Features couvertes | 27 |
| Engines analysés (Vue) | 21 composables |
| Engines analysés (Angular) | 23 classes |
| Lignes de spec totales | ~2 940 |

## Pour les contributeurs

Toute modification de comportement public d'une lib doit s'accompagner d'une mise à jour du chapitre correspondant **dans la même PR**. Détails dans le chapitre Annexe, section « Comment contribuer ».

## Pour les consommateurs du grid

Cette spec décrit le contrat interne et les couplages internes. Si tu écris une app qui utilise `<ad-grid-vue>` (Vue) ou `<ad-grid-angular>` (Angular), va plutôt voir :

- Le tutoriel **Quick Start** dans le Storybook de la lib que tu utilises (Vue port 6006, Angular port 6007).
- La page **API Reference** qui synthétise les props/events/slots.
- Le portal Storybook agrégé (port 6008 en prod) qui rassemble les deux.

Cette spec reste la référence ultime : si le tutoriel et la spec divergent, **la spec gagne** et le tutoriel doit être mis à jour.

---

*La spec et le code évoluent ensemble.*
