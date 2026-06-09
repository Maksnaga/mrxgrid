# Plan i18n — Mozaic Grid

> Statut : **proposition à valider**
> Cible : Angular 21 (standalone, signals, zoneless-ready)
> Auteur : à valider par Maxime

---

## 1. Objectif

Permettre à une app consommatrice de **fournir ses propres traductions** à la grid, au **runtime**, avec **changement de langue à chaud** (sans reload). La lib ne doit dépendre d'**aucune** techno i18n côté consommateur (ni `@angular/localize`, ni ngx-translate, ni transloco) : le consommateur branche la source qu'il veut.

---

## 2. Décision d'architecture

**Retenu : token d'injection runtime + dictionnaire de labels en signals** (pattern `MatPaginatorIntl` de Material/CDK).

**Écarté pour la lib : `@angular/localize` en mécanisme principal.** Raisons :

| Critère | Token runtime (retenu) | `@angular/localize` |
|---|---|---|
| Moment de résolution | Runtime | Compile-time (figé dans le bundle) |
| Switch de langue à chaud | ✅ via signals | ❌ 1 bundle = 1 langue |
| Couplage au build du consommateur | Aucun | Fort (extraction xliff, 1 build/locale) |
| Source des trads | Libre (objet, ngx-translate, transloco, `$localize`…) | Imposée (`localize`) |
| Idiome lib Angular | ✅ standard (Material/CDK) | Conçu pour les apps |

> `@angular/localize` **reste utilisable côté app consommatrice** pour _alimenter_ le token (`label: $localize\`...\``). Le token est donc un sur-ensemble, pas une alternative qui exclut localize.

---

## 3. État des lieux (audit réalisé)

- **Aucun système i18n centralisé** dans `lib/grid`.
- **Chaînes en dur** dispersées dans ~20 composants (`components/**`).
- **Locales déjà mélangées** (dette à corriger au passage) :
  - 🇫🇷 `keyboard-shortcuts-drawer`, `formula-reference-drawer`, `cell` (`aria-label="Erreur de validation"`).
  - 🇬🇧 `footer` (`Rows per page:`), `settings-drawer` (`Find a column`, `Apply`, `Reset`), `empty-state` (`No matching results`…), `loading-indicator` (`Loading more data...`), `selection-bar` (`Bulk actions`).
- **Approche ad-hoc déjà présente à généraliser/déprécier** : inputs `emptyDataTitle`, `emptyDataDescription`, `noResultsTitle`, `noResultsDescription`, `noResultsActionLabel`.
- **Labels statiques** à intégrer : `OPERATOR_LABELS` (`models/filter.model.ts`), `DENSITY_LABELS` (`settings-drawer`).
- **Cas particulier formula** : `formula.engine.ts` a déjà sa propre notion `locale: 'en' | 'fr'` (séparateur d'args `,` vs `;`). Cette locale **fonctionnelle** (parsing) est distincte des **labels UI** — à articuler proprement (cf. §8).

---

## 4. Architecture cible

### 4.1 Le contrat de labels

Un fichier `i18n/grid-i18n.ts` (nouveau dossier `lib/grid/i18n/`) :

```ts
// i18n/grid-i18n.model.ts
export interface AdeoGridLabels {
  // --- Footer / pagination ---
  rowsPerPage: string;                                  // "Rows per page:"
  rangeLabel: (start: number, end: number, total: number) => string; // "1–20 of 240"
  // --- Empty / no-results ---
  emptyTitle: string;
  emptyDescription: string;
  noResultsTitle: string;
  noResultsDescription: string;
  clearFilters: string;
  // --- Selection bar ---
  bulkActions: string;
  clearSelection: string;
  selectedCount: (n: number) => string;                 // "3 selected" / ICU pluriel
  // --- Settings / columns ---
  findColumn: string;
  searchColumns: string;
  apply: string;
  reset: string;
  density: Record<GridDensity, string>;                 // remplace DENSITY_LABELS
  // --- Filtres ---
  operators: Record<FilterOperator, string>;            // remplace OPERATOR_LABELS
  // --- Loading ---
  loadingMore: string;
  // --- Validation ---
  validationError: string;                              // "Erreur de validation"
  // --- Formula reference drawer ---
  searchFunction: string;
  // --- Keyboard shortcuts drawer ---
  shortcuts: Record<string, string>;                    // clé stable -> libellé
  // … (liste complète figée pendant l'inventaire exhaustif, étape 6.1)
}
```

> Principe : **clés stables** côté lib, **valeurs** fournies par le consommateur. Les libellés à variables sont des **fonctions** (`rangeLabel`, `selectedCount`) — gère l'ordre des mots et les pluriels sans hack de concaténation.

### 4.2 Valeurs par défaut

`i18n/grid-i18n.default.ts` : un `DEFAULT_MOZ_GRID_LABELS: AdeoGridLabels` **100 % anglais** (locale de référence d'une lib). La grid est utilisable **sans config** et **sans locale mélangée** (corrige la dette FR/EN).

### 4.3 Le service `AdeoGridIntl` (signals, réactif à chaud)

```ts
// i18n/grid-intl.service.ts
@Injectable()
export class AdeoGridIntl {
  private readonly _labels = signal<AdeoGridLabels>(DEFAULT_MOZ_GRID_LABELS);
  readonly labels = this._labels.asReadonly();
  setLabels(partial: Partial<AdeoGridLabels>): void {
    this._labels.update(cur => ({ ...cur, ...partial }));
  }
}
```

- Réactif : `setLabels()` met à jour un signal → tous les composants qui lisent `intl.labels()` se re-rendent → **switch de langue instantané**.
- `Partial<>` : le consommateur ne surcharge que ce qu'il veut.

### 4.4 API de provisioning consommateur

```ts
// i18n/provide-grid-i18n.ts
export function provideAdeoGridI18n(
  labels?: Partial<AdeoGridLabels> | (() => Partial<AdeoGridLabels>)
): EnvironmentProviders;
```

Variante avec **factory réactive** (pour brancher ngx-translate/transloco/$localize et re-pousser au changement de langue).

### 4.5 Portée d'injection

- **Provider global** (app-level) via `provideAdeoGridI18n(...)` dans `bootstrapApplication`.
- **Override local** possible : re-provide `AdeoGridIntl` au niveau d'un composant hôte de grid (ex. une grid dans une autre langue sur la même page).

---

## 5. Usage côté consommateur (exemples cibles)

**a) Objet statique (le plus simple)**
```ts
bootstrapApplication(App, {
  providers: [provideAdeoGridI18n(FR_GRID_LABELS)],
});
```

**b) ngx-translate / transloco (réactif)**
```ts
provideAdeoGridI18n(() => ({
  rowsPerPage: translate('grid.rowsPerPage'),
  apply: translate('grid.apply'),
  // …
}))
// + un effect côté app qui appelle intl.setLabels(...) sur langChange
```

**c) `@angular/localize` côté app**
```ts
provideAdeoGridI18n({
  apply: $localize`:@@grid.apply:Apply`,
  rowsPerPage: $localize`:@@grid.rowsPerPage:Rows per page:`,
})
```

> Les 3 sources coexistent : la lib ne sait pas d'où viennent les chaînes.

---

## 6. Plan de migration (par étapes, incrémental, non-breaking)

### Étape 0 — Cadrage (ce doc) ✅
Validation de l'architecture.

### Étape 1 — Inventaire exhaustif + gel des clés
- Script de scan (déjà amorcé) → liste **complète** des chaînes UI par composant.
- Figer l'interface `AdeoGridLabels` finale + le `DEFAULT` anglais.
- **Livrable** : `AdeoGridLabels` + `DEFAULT_MOZ_GRID_LABELS` revus.

### Étape 2 — Socle i18n
- Créer `i18n/` : model, default, service `AdeoGridIntl`, `provideAdeoGridI18n`.
- Exporter depuis `index.ts`.
- **Aucune** modif de composant encore → 0 régression.

### Étape 3 — Migration composant par composant
Ordre suggéré (du plus visible au plus profond) :
1. `footer` (pagination) — `rowsPerPage`, `rangeLabel`.
2. `empty-state` — branche aussi les inputs ad-hoc existants (cf. §7).
3. `settings-drawer` + `DENSITY_LABELS`.
4. `selection-bar` + `selectedCount` (ICU).
5. `filter-builder` / `filter-drawer` + `OPERATOR_LABELS`.
6. `loading-indicator`, `cell` (validation), `column-visibility-panel`.
7. `keyboard-shortcuts-drawer`, `formula-reference-drawer` (déjà FR → passer par clés).

Pour chaque composant : `inject(AdeoGridIntl)`, remplacer le littéral par `intl.labels().<clé>`, supprimer le texte en dur. Mettre à jour le `.spec` correspondant.

### Étape 4 — Dépréciation des inputs ad-hoc
- Conserver `emptyDataTitle`, `noResultsActionLabel`, etc. mais les marquer `@deprecated` (priorité : input > token > default). Migration douce, pas de breaking change.

### Étape 5 — Aria / accessibilité
- Tous les `aria-label` en dur passent par le token (a11y multilingue).

### Étape 6 — Docs & Storybook
- Story « Internationalization » (switch EN/FR live pour démontrer le réactif).
- Section README : `provideAdeoGridI18n`, table des clés, exemples a/b/c.
- Fournir un **pack FR de référence** (`FR_GRID_LABELS`) exporté en option (utile, vu la dette FR existante), sans en faire une dépendance.

---

## 7. Articulation avec l'existant

- **Inputs ad-hoc** (`emptyDataTitle`…) : priorité de résolution `input() ?? token ?? default`. On ne casse rien, on déprécie.
- **`OPERATOR_LABELS` / `DENSITY_LABELS`** : deviennent les valeurs par défaut de `labels.operators` / `labels.density`, surchargeables via token. On garde l'export pour rétrocompat (re-pointé sur le default).

---

## 8. Cas particuliers à trancher

1. **Locale « fonctionnelle » des formules** (`,` vs `;`, déjà `en|fr`) : **distincte** des labels UI. Proposition : garder l'input `locale` du formula-editor pour le **parsing**, mais router les **libellés** UI du module formule via le token. → 1 question ouverte : veut-on **dériver** automatiquement le séparateur d'args depuis la locale active, ou rester explicite ? (défaut proposé : rester explicite, zéro magie).
2. **Pluriels** (`selectedCount`, `rangeLabel`) : fonctions plutôt que concat. Si besoin ICU avancé, le consommateur peut brancher son moteur dans la fonction.
3. **Formats nombres/dates** : hors périmètre labels — relèvent de `Intl.NumberFormat`/`DatePipe` + `LOCALE_ID`. À documenter comme **séparé** de ce plan (ne pas confondre traduction de libellés et formatage locale).
4. **Export (noms de fichiers / en-têtes)** : vérifier si `export.engine.ts` génère du texte visible → si oui, l'ajouter au token.

---

## 9. Tests & vérification

- **Unit** : chaque composant migré lit bien le token (spec : override via `AdeoGridIntl`, assert DOM).
- **Réactivité** : test « setLabels → le DOM change sans recréer le composant ».
- **Non-régression** : la grid sans `provideAdeoGridI18n` affiche les défauts anglais (snapshot).
- **Garde-fou anti-dette** : test/lint qui échoue si une chaîne UI **en dur** réapparaît dans `components/**` (regex sur littéraux dans templates) — empêche la régression FR/EN mélangée.
- **Storybook** : story switch EN/FR validée visuellement.

---

## 10. Checklist de livraison

- [ ] `AdeoGridLabels` figée (inventaire exhaustif)
- [ ] `DEFAULT_MOZ_GRID_LABELS` 100 % EN cohérent
- [ ] `AdeoGridIntl` + `provideAdeoGridI18n` + export `index.ts`
- [ ] ~20 composants migrés (+ specs)
- [ ] Inputs ad-hoc `@deprecated`
- [ ] `OPERATOR_LABELS`/`DENSITY_LABELS` reliés
- [ ] Aria-labels couverts
- [ ] Pack `FR_GRID_LABELS` de référence exporté
- [ ] Story i18n + README
- [ ] Lint anti-chaîne-en-dur

---

## Décisions encore ouvertes (pour toi)

1. Séparateur d'args formules : **dérivé** de la locale active ou **explicite** ? (défaut proposé : explicite)
2. Fournir un **pack FR officiel** dans la lib, ou laisser 100 % au consommateur ? (défaut proposé : fournir FR en option, vu la dette existante)
3. Périmètre : **labels uniquement**, ou inclure aussi le **formatage** nombres/dates (`LOCALE_ID`) dans ce chantier ? (défaut proposé : labels d'abord, formatage en lot 2)
