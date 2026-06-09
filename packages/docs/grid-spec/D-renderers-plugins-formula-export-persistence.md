# Renderers, Plugins, Formula, Export, Persistance d'état

Cette spec couvre la « surface d'extension » de `@adeo/grid-vue` et `@adeo/grid-angular` :
comment les consommateurs projettent une UI personnalisée dans les cellules, accrochent des comportements transverses sur
le moteur, pilotent la couche de formules de type tableur, exportent les données sur disque, et
font transiter l'état de colonnes / tri / filtre via `localStorage`.

Les deux librairies partagent le même flux de données :
définition de colonne → état → moteur → rendu. Le chapitre fixe l'emplacement de chaque jointure publique de chaque côté.

---

<a id="renderers"></a>
## Renderers de cellule, header, filtre, édition
### Rôle

Permettre aux consommateurs de remplacer le rendu texte par défaut d'une cellule, d'un header, d'un
input de filtre ou d'un éditeur inline par une UI entièrement personnalisée. Le contrat est une
**jointure de projection, pas un registre** — il n'y a pas d'indirection `registerRenderer(name)`.
Une colonne utilise soit le chemin texte par défaut, soit pointe vers un
template / composant / slot.

### Contrat de comportement

- Portée du renderer par cellule : `value`, `row`, `field`, `rowIndex`, `column`.
  Les slots d'édition inline reçoivent en plus `editing`, `editValue`,
  `updateValue(v)`, `commit(direction?)`, `cancel()`, `startEdit()` et
  `active`.
- Ordre de résolution (priorité la plus haute en premier) :
  1. Projection par champ : slot Vue `#cell-{field}` / colonne Angular
     `cellTemplate` (TemplateRef ou Type de composant standalone).
  2. Projection générique : slot Vue `#cell` / template Angular au niveau de la grille.
  3. Fonction renderer au niveau colonne : `ColumnDef.renderer` Vue (un
     `Raw<Component>`) / `cellTemplate: Type<unknown>` Angular consommé via
     `ngComponentOutlet`.
  4. Texte par défaut : `valueFormatter(value, row) ?? String(value)`.
- Le `valueGetter` s'exécute *avant* le renderer ; le renderer voit la valeur récupérée,
  pas la propriété brute de la ligne. `valueFormatter` est **court-circuité** lorsqu'un
  renderer est actif (le renderer prend en charge le formatage).
- Les renderers sont des fonctions de rendu pures / composants d'affichage — ils NE DOIVENT PAS
  muter `row` ni appeler les API d'édition / sélection de manière impérative. Les changements d'état passent
  par les helpers du slot d'édition (`updateValue` / `commit` / `cancel`) ou l'API
  impérative de la grille.
- Les renderers de filtre reçoivent `{ column, value, setValue, clear }` et sont
  responsables d'émettre les changements de valeur ; la ligne de filtre est affichée pour les colonnes
  qui déclarent soit une forme `filter`, soit un `filterRenderer` /
  `filterTemplate`, soit `searchVisible: true`.
- La densité (`'comfortable' | 'standard' | 'compact'`) est exposée via une classe CSS
  sur la racine de la grille — les renderers doivent la lire via les variables CSS (ou
  `getComputedStyle`). Elle n'est intentionnellement **pas** passée en prop afin de garder
  le contrat du renderer minimal.

### Helpers `defineStatusRenderer` et `builtin` — **côté démo, PAS API de la librairie**

`defineStatusRenderer(map)` et le registre `builtin: { tag: … }` ont été
intentionnellement **sortis de la librairie** dans la tâche #133. Ils vivent désormais dans
les applis de démo :

- Vue : `apps/grid-vue/src/app/renderers/defineStatusRenderer.ts` et
  `MTagRenderer.ts`.
- Angular : factory équivalente sous `apps/grid-angular/.../app/renderers/`.

La librairie n'expose que la jointure de projection (`renderer` / `cellTemplate`)
plus les contrats de types (`CellRendererProps`, `CellSlotProps`). Les consommateurs copient
ces helpers, ou écrivent leur propre factory retournant un
`Raw<Component>` (Vue) / `Type<{ value }>` (Angular).

Confirmé dans `apps/grid-angular/.../grid/index.ts` :

> Note : `defineStatusRenderer` + `BUILTIN_RENDERERS` (alias « tag ») étaient
> des helpers de confort côté consommateur qui ont été retirés de la
> librairie. Les consommateurs peuvent écrire leur propre factory de renderer…

### API publique

| Préoccupation | Surface |
|---|---|
| Définition de colonne (Vue) | `renderer?: 'text' \| Raw<Component>`, `rendererProps?: Record<string, unknown>`, `valueGetter?(row): unknown`, `valueFormatter?(value, row): string`, `cellClass?: string \| (row) => string`, `filterRenderer?: Raw<Component>` |
| Définition de colonne (Angular) | `cellTemplate?: TemplateRef<unknown> \| Type<unknown>`, `editTemplate?: TemplateRef<unknown>`, `filterTemplate?: TemplateRef<unknown>`, `valueGetter`, `valueFormatter`, `cellClass`, `headerClass` |
| Slots (Vue) | `#cell-{field}` / `#cell`, `#header-{field}` / `#header`, `#filter-{field}` / `#filter`, `#edit-{field}` / `#edit` |
| Projection (Angular) | TemplateRef sur `<ng-template>` déclaré comme `cellTemplate` / `editTemplate` / `filterTemplate` sur le `ColumnDef`, ou input `[cellTemplate]` de la directive `<moz-column>` |
| Props du renderer | `{ value, row, field, rowIndex, column }` (`CellRendererProps`) |
| Props du slot d'édition | étend les props du renderer avec `{ editing, editValue, active, startEdit, updateValue, commit, cancel }` (`CellSlotProps`) |

### Contrat d'implémentation (interne)

- Vue : `Grid.vue` collecte les slots racine via `useSlots()` et les re-fournit
  via `GRID_SLOTS_KEY` afin que les composants de cellule puissent résoudre
  `#cell-{field}` sans prop drilling (voir `_slotsContext.perField`).
- Angular : `ColumnDef.cellTemplate` est consommé dans `grid-cell` via
  `<ng-container *ngTemplateOutlet="…" />` pour TemplateRef, ou
  `<ng-container *ngComponentOutlet="…">` pour `Type<unknown>`.
- Le chemin texte par défaut passe par `valueFormatter`. Les renderers et slots
  court-circuitent ce chemin.

### Mapping Vue

- `apps/grid-vue/src/components/Grid/types.ts` — `CellRendererProps`,
  `CellSlotProps`, `ColumnDef.renderer`, `ColumnDef.filterRenderer`.
- `apps/grid-vue/src/components/Grid/Grid.vue` — `useSlots()` +
  provide `GRID_SLOTS_KEY` (lignes ~430-475).
- Helpers de démo : `apps/grid-vue/src/app/renderers/defineStatusRenderer.ts`,
  `MTagRenderer.ts`.

### Mapping Angular

- `apps/grid-angular/.../grid/models/column.model.ts` — typages `cellTemplate`,
  `editTemplate`, `filterTemplate`, `filterComponent`.
- `apps/grid-angular/.../grid/components/cell/grid-cell.ts` — le composant de cellule
  dispatche entre texte / TemplateRef / composant standalone.

## Plugins
### Rôle

Comportements transverses optionnels que le cœur de la grille n'embarque pas — par exemple analytique,
presets de colonnes, décoration de ligne personnalisée. Un plugin est un petit objet avec un
`name` et un `init(ctx)` qui s'exécute une fois et peut retourner un disposer.

### Contrat de comportement

- Les plugins sont passés en **prop / input** au montage, et non enregistrés
  globalement. Cycle de vie :
  1. La grille initialise les engines.
  2. Pour chaque plugin, `init({ state, engine })` est appelé. La valeur de retour, si
     c'est une fonction, est stockée comme disposer.
  3. Lorsque l'input `plugins` change, les disposers précédents sont appelés et
     `init` est réexécuté pour la nouvelle liste.
  4. À la destruction de la grille, tous les disposers sont appelés.
- Le contexte expose le **state manager** (signals / refs) et le **moteur de grille**
  (orchestrateur). Les plugins lisent et écrivent les signals pour superposer un
  comportement — il n'y a pas de bus d'événements séparé.
- Aucune garantie d'ordre entre plugins. Pas de hooks `before` / `after`. Le
  contrat est intentionnellement minimal — les plugins sont des « observateurs ambiants », pas
  un middleware.
- Garanties équivalentes par framework :
  - Vue : `init` s'exécute dans la scope réactive `setup` ; les refs sont vivantes.
  - Angular : `init` s'exécute dans un `effect()` racine, donc les lectures de signals sont trackées.

### API publique

| Préoccupation | Surface |
|---|---|
| Inputs / props | `plugins?: GridPlugin[]` (Vue) / `[plugins]: GridPlugin[]` (Angular) |
| Forme du plugin | `{ name: string; init(ctx: { state, engine }): (() => void) \| void }` |
| Contexte | `state: GridStateManager` (Ang) / `GridState` (Vue), `engine: GridEngine` |
| Disposer | retour optionnel d'`init`, appelé au changement d'input ou à la destruction |

### Contrat d'implémentation (interne)

- Les plugins NE DOIVENT PAS souscrire en dehors de la scope de leur disposer — ils sont
  responsables du démontage des listeners, timers, etc.
- Ils PEUVENT écrire dans les signals d'état publics (`columnStates`, `activeSorts`,
  `filterModel`, …) mais NE DEVRAIENT PAS toucher aux internes des engines.
- Ils s'exécutent après le câblage des engines mais avant le premier commit de rendu, donc
  leurs écritures initiales sur les signals sont reflétées dès la toute première frame.

### Mapping Vue

- Modèle : `apps/grid-vue/.../Grid/models/plugin.model.ts` —
  interface `GridPlugin` (miroir du `GridPlugin` Angular).
- Câblage : le bloc props d'`Grid.vue` accepte `plugins?: GridPlugin[]`
  (voir la JSDoc de `props.plugins` autour du bloc `persistKey`).
- Contexte du moteur : `useGridEngine.ts` expose `state` + le bundle complet du moteur
  que reçoit le plugin.

### Mapping Angular

- Modèle : `apps/grid-angular/.../grid/models/plugin.model.ts` :
  ```ts
  export interface GridPlugin<T = unknown> {
    name: string;
    init(ctx: { state: GridStateManager<T>; engine: GridEngine<T> }):
      (() => void) | void;
  }
  ```
- Câblage : `grid.ts` ligne ~881 déclare `readonly plugins = input<GridPlugin[]>([])`.
  L'init / cleanup s'exécute dans un `effect()` autour de la ligne 1515 :
  ```ts
  effect(() => {
    const pluginList = this.plugins();
    for (const dispose of this.pluginDisposers) dispose();
    this.pluginDisposers = [];
    for (const plugin of pluginList) {
      const disposer = plugin.init({ state: …, engine: … });
      if (typeof disposer === 'function') this.pluginDisposers.push(disposer);
    }
  });
  ```
  `ngOnDestroy` (~ligne 3153) draine les disposers une dernière fois.

## Formula Engine
### Rôle

Une couche de formules de type tableur indexée par `(rowId, field)`. Les colonnes y adhèrent
via `allowFormula: true`. Le moteur prend en charge parse → graphe de dépendances →
évaluation topologique, expose un signal/ref `values` que lit le renderer,
et fournit `invalidate(addr)` explicite pour les éditions hors-formule afin que les dépendants
recalculent sans réévaluation globale.

### Contrat de comportement

- Une cellule devient une formule lorsque :
  - la colonne a `allowFormula: true`, **et**
  - la valeur committée est une `string` dont le premier caractère non-whitespace est `=`.
- Identité : une cellule formule est indexée par `{ rowId, field }` où `rowId` est
  résolu par le `rowIdField` de la grille ou un callback `setRowIdResolver`
  personnalisé. Les lignes sans id stable sont ignorées (pas d'enregistrement de formule).
- Forme de stockage : forme longue `=REF(COLUMN("price"),ROW(1))*B1`. **La forme de surface**
  (ce que l'utilisateur voit / édite) est A1 : `=A1*B1`.
- Traduction :
  - **A1 → forme longue au commit** (afin que le stockage survive aux
    réordonnancements de colonnes / lignes). Géré par le moteur, **pas** par le composant hôte.
  - **Forme longue → A1 au début d'édition** (`displayFormula(addr)`).
- Les erreurs remontent en `FormulaValue` de kind `error` avec les codes
  `#PARSE!`, `#REF!`, `#CYCLE!`, `#DIV/0!`, `#NAME!`, `#VALUE!`.
- Les fonctions sont pluggables via `setFunctions(registry)`. Le set par défaut est
  `DEFAULT_FORMULA_FUNCTIONS` (ré-exporté depuis `index.ts`).
- La locale (`'en' | 'fr'`) bascule les alias de noms de fonctions (par exemple `SUM` ↔ `SOMME`)
  via `setLocale`.
- `syncFromSource(allowFormula)` réconcilie les formules cuites dans les données source
  — utilisé au montage, au remplacement du data-set, et après un collage en masse.
- `rebuild()` reparse chaque formule stockée — appelé lors des réordonnancements / masquages de
  colonnes car les lettres A1 sont remappées.

### VUE-DEBT-2 — A1 ↔ stockage côté moteur

Auparavant, `Grid.vue` exécutait un `watch` Vue qui miroitait chaque cellule
éditée d'avant en arrière entre A1 et forme longue. Ce watcher a été **SUPPRIMÉ** ;
la conversion vit désormais entièrement dans `useInlineEditEngine.ts` :

- `startEdit` appelle `formulaEngine.displayFormula(addr)` lorsque
  `allowFormula` est vrai et que la valeur stockée commence par `=`. Retombe
  sur la valeur brute lorsque le moteur n'a pas encore d'entrée.
- Le chemin de commit passe la chaîne A1 brute à `formulaEngine.set(addr, …)`
  dans `flushEdit`. `set()` exécute `a1ToLongForm` en interne avant le stockage.

Cela correspond au flux `InlineEditEngine.commitEdit` d'Angular, qui exécute la
conversion A1 → forme longue *avant* d'écrire dans `sourceData` (voir
le helper `a1DraftToStorage`). Une seule source de vérité, pas de race conditions de watcher, pas de
churn de dataVersion.

### API publique

| Préoccupation | Surface |
|---|---|
| Flag de colonne | `ColumnDef.allowFormula?: boolean` (implique `editable: true`) |
| Moteur — lecture | `values: ReadonlyMap<string, FormulaValue>` (ref Vue / signal Angular), `hasAnyFormula`, `isFormulaEditActive`, `valueAt(addr)`, `getFormula(addr)`, `displayFormula(addr)`, `hasFormula(addr)` |
| Moteur — écriture | `set(addr, raw): FormulaValue`, `remove(addr)`, `invalidate(addr)`, `clear()`, `syncFromSource(allowFn)`, `rebuild()` |
| Moteur — config | `setFunctions(registry)`, `getFunctions()`, `setLocale('en' \| 'fr')`, `setRowIdResolver(fn \| null)` (Angular) |
| Impératif (grille) | La grille Vue expose `setFormula`, `getFormula`, `getFormulaValue`. `<ad-grid-angular>` Angular expose le moteur directement. |
| Adresse | `{ rowId: string \| number, field: string }` |
| Valeur | union discriminée — `number`, `string`, `boolean`, `date`, `empty`, `error{ code, message }` |

### Contrat d'implémentation (interne)

- **État** : `cells: Map<key, CellEntry>`, `dag: FormulaDag`, signal `valuesRef` /
  `values`. `CellEntry` détient `{ formula (forme longue), source (Vue
  uniquement — surface utilisée lors du dernier set), ast, value }`.
- **Ordre d'évaluation** : topologique depuis la cellule changée ; les cycles court-circuitent vers
  `#CYCLE!`.
- **Couplage** : lit `sourceData`, `visibleColumns`, `rowIdField`, et
  `cellEditState` (pour `isFormulaEditActive`). Les écritures passent par
  `valuesRef`. Le moteur d'édition inline est le seul writer qui appelle `set` /
  `remove` / `invalidate` ; les chemins clipboard / fill appellent `invalidate` après
  les écritures en masse.
- **Cache** : Angular maintient un `_rowIndexCache` indexé par `rowId` (LRU
  invalidé au changement de référence de `sourceData`). Vue est actuellement
  `@ts-nocheck` (port orchestrateur) et reconstruit la map d'index à chaque appel.

### Mapping Vue

- Orchestrateur : `apps/grid-vue/.../Grid/features/formula/useFormulaEngine.ts`
  (`@ts-nocheck` — typage strict en attente des tests d'intégration).
- Utilitaires (10 fichiers indépendants du framework, portés à l'identique depuis Angular) :
  `formula-tokenizer.ts`, `formula-parser.ts`, `formula-ast.ts`,
  `formula-evaluator.ts`, `formula-dag.ts`, `formula-ref-mapper.ts`,
  `formula-shift.ts`, `formula-suggestions.ts`, `formula-ref-palette.ts`,
  `formula-functions.default.ts`.
- Service de highlight : `useRefHighlight.ts`.
- Édition inline : `apps/grid-vue/.../features/useInlineEditEngine.ts`
  (`resolveEditValue` pour l'affichage A1, voir lignes ~50-70).
- Hook hôte : `flushEdit` d'`Grid.vue` appelle `gridEngine.formula.set` /
  `remove` / `invalidate` après `applyFills` (lignes ~2790-2845). Le
  watcher préexistant a été supprimé (VUE-DEBT-2 clos).

### Mapping Angular

- Service : `apps/grid-angular/.../grid/features/formula/formula.engine.ts`
  (`@Injectable()` avec `inject(GridStateManager)`).
- Utilitaires : même famille de 10 fichiers, typage natif (`noUncheckedIndexedAccess: true`).
- Highlight des refs : `formula-ref-highlight.service.ts`.
- Hook d'édition inline : `inline-edit.engine.ts` lignes ~140-160 — le helper `a1DraftToStorage`
  exécute `a1ToLongForm` avant d'écrire dans `sourceData`. Le moteur
  injecte `FormulaEngine` avec `{ optional: true }` afin que les tests sans provider
  de formule continuent à fonctionner.

## Export
### Rôle

Sérialiser la grille en CSV ou JSON et déclencher un téléchargement navigateur.
Honore le `valueGetter` / `valueFormatter` / `headerName` de chaque colonne, afin que
le payload exporté corresponde à ce que voit l'utilisateur, pas aux données brutes
sous-jacentes.

### Contrat de comportement

- **Quelles lignes sont exportées** : le consommateur passe le tableau. Le moteur
  ne parcourt pas implicitement `sourceData`. Passer `filteredSortedRows` (depuis
  l'API impérative de la grille) pour exporter la vue courante de l'utilisateur, ou
  `props.rows` pour exporter le set non filtré.
- **Quelles colonnes sont exportées** : `state.visibleColumns()` par défaut
  (c'est-à-dire respecte le masquage de colonnes). Surcharger avec `options.columns: string[]`
  pour whitelister par field. Les colonnes masquées ne sont jamais incluses sauf
  si whitelistées.
- **Échappement CSV** : RFC 4180. Les valeurs contenant le séparateur, un `"`, ou
  `\n` sont entourées de `"…"` et les guillemets internes sont doublés. Le séparateur
  par défaut est `,` ; les consommateurs peuvent surcharger (`;` pour Excel FR / DE / PT).
- **Résolution de valeur par cellule** :
  1. `valueGetter(row)` si défini, sinon `row[field]`.
  2. CSV uniquement : `valueFormatter(value, row)` si défini, sinon
     `String(value ?? '')`.
  3. JSON : valeur brute de l'étape 1 (pas de formatter appliqué — préserve les types).
- **Headers** : `headerName ?? field`. Basculer avec `includeHeaders` (CSV
  uniquement, `true` par défaut).
- **Nom de fichier** : `${filename}.csv` / `${filename}.json`, par défaut
  `'export'`.
- **Streaming (B18)** : lorsque `TransformStream` est disponible, `exportCsv`
  et `exportJson` écrivent des chunks de 1 000 lignes via un stream
  et produisent un `Blob` via `new Response(ts.readable).blob()`. Le fallback synchrone
  (concaténation de strings) entre en jeu pour les tests unitaires jsdom et
  les navigateurs legacy. Seuil pour le streaming : toute taille — le chemin stream est
  toujours préféré quand l'API existe, car il plafonne le pic de heap.

### API publique

| Préoccupation | Surface |
|---|---|
| `exportCsv(data, options?)` | `options: { filename?, separator?, includeHeaders?, columns? }`, fire-and-forget |
| `exportJson(data, options?)` | `options: { filename?, columns? }`, fire-and-forget |
| Impératif sur la grille | Vue : `setupExpose.exportCsv` / `exportJson` ré-exposés sur l'hôte. Angular : `<ad-grid-angular>` expose l'`ExportEngine` (et l'input `exportable` conditionne le bouton de la toolbar). |

### Contrat d'implémentation (interne)

- Sans état hormis la lecture de `state.visibleColumns` et `state.columnDefMap`.
  Aucun signal possédé, aucun couplage avec filtre / tri / groupement au-delà de ce que
  le consommateur passe en entrée.
- Le téléchargement est déclenché via un `<a download>` éphémère + `URL.createObjectURL`,
  révoqué de manière synchrone après `link.click()`.
- Mémoire : le chemin streaming borne le pic de heap à ~`CHUNK * row_size`
  (≈1 Mo pour 1000 lignes larges). Le fallback sync alloue une grosse string ≈
  taille totale de la sortie.

### Mapping Vue

- Fichier : `apps/grid-vue/.../Grid/features/useExportEngine.ts`.
- Composable : `useExportEngine(state) → { exportCsv, exportJson }`.
- Méthodes : `exportCsv`, `exportJson`. Helpers privés : `buildCsvRow`,
  `escapeCsvValue`, `exportCsvStreaming`, `exportJsonStreaming`,
  `downloadBlob`, `downloadFile`.
- Chemin d'état : `state.visibleColumns.value`, `state.columnDefMap.value`.

### Mapping Angular

- Fichier : `apps/grid-angular/.../grid/features/export.engine.ts`.
- Classe : `@Injectable() ExportEngine<T>` injectant `GridStateManager`.
- Méthodes identiques à Vue (`exportCsv`, `exportJson`) ; helpers privés aux
  mêmes noms. Mêmes streaming + fallback sync.
- Chemin d'état : `this.state.visibleColumns()`, `this.state.columnDefMap()`.

## Persistance d'état
### Rôle

Faire transiter l'état de vue de l'utilisateur — largeurs de colonnes, ordre, visibilité, côté de
pin, tris actifs, conditions de filtre — via `localStorage`, indexé par
une `persistKey` stable. Conçu pour une UX « rappelle-toi ma vue ». Best-effort :
toute erreur de storage est silencieusement avalée (quota, mode privé, SSR).

### Contrat de comportement

- **Ce qui est persisté** (par entrée de colonne) :
  `field`, `currentWidth`, `order`, `visible`, `pinned` ∈ `'start' | 'end' | null`.
  Plus `sorts: SortDef[]` et `filters: Omit<FilterCondition, 'id'>[]`.
- **Ce qui n'est PAS persisté** (délibéré) :
  - Groupement (`activeGrouping`) — l'état de groupe est trop couplé aux
    snapshots de données pour transiter de manière sûre.
  - Expansion (`expandedRowIds`) — re-dérivé depuis les données.
  - Sélection — transitoire, jamais persistée.
  - Brouillons d'édition inline — transitoires.
  - Valeurs de formules — dérivées de `sourceData`.
- **Sémantique de restauration** :
  - Matching par `field`. Les fields sauvegardés qui n'existent plus (colonne supprimée)
    sont ignorés. Les fields vivants absents du payload sauvegardé (colonne ajoutée) gardent
    leur état par défaut.
  - Les `id` des conditions de filtre sont strippés à la sauvegarde et régénérés à la
    restauration (`generateConditionId()`) — ce sont des handles runtime uniquement.
  - Le `sortIndex` du tri est reconstruit depuis la position dans `persisted.sorts`.
- **Gestion des erreurs** : chaque accès `localStorage` est encapsulé dans
  un `try / catch`. Le moteur ne lève jamais.

### Persistance de l'historique

Surface indépendante, vit dans `historyEngine` :

- `historyEngine.attach(persistKey)` lie les stacks past / future à
  `localStorage` sous `adeo-grid-history:<persistKey>`. Passer `null` pour
  détacher (nettoie les stacks en mémoire uniquement — l'entrée de storage est laissée
  intacte jusqu'à l'appel de `clear()`).
- Les stacks sont plafonnées à `MAX_HISTORY = 50` opérations pour borner la taille du payload.
- Chaque mutation déclenche un `persist()` (`record`, `undo`, `redo`,
  `clear`).
- Restauration à l'`attach` : les stacks sont initialisées depuis l'entrée sauvegardée (best
  effort).

### Item 8 — polish de la clé d'attach de l'historique

Angular câble `historyEngine.attach(this.persistKey())` dans un `effect()`
racine (`grid.ts` ligne ~1186) — un namespace localStorage par
vue, historique lié automatiquement.

Vue le miroite dans `Grid.vue` via :
```ts
watch(
  () => ({ persistKey: props.persistKey, historyId: props.historyId }),
  ({ persistKey, historyId }) => {
    // historyId (deprecated) wins over persistKey when both sont set
    // pour ne pas changer le namespace storage d'un consumer existant.
    const id = historyId ?? persistKey ?? null
    gridEngine.history.attach(id)
  },
  { immediate: true },
)
```

**Statut Item 8 — closed (warning-deprecated).** La prop `historyId` est
désormais marquée `@deprecated` dans le bloc props (JSDoc) et un
`console.warn` en mode dev s'affiche au premier render quand un consumer
la passe encore. Le chemin canonique est `persistKey` (aligned Angular —
`historyEngine.attach(persistKey)`). `historyId` reste fonctionnel pour
back-compat et sera retiré en v2.0.

### API publique

| Préoccupation | Surface |
|---|---|
| Inputs / props | `persistKey?: string` (la clé localStorage). Vue accepte aussi `historyId?: string` (legacy, `@deprecated` — warning dev, retrait en v2.0). |
| API du moteur | `save(storageKey)`, `restore(storageKey): boolean`, `clear(storageKey)` |
| API de l'historique | `historyEngine.attach(gridId \| null)`, `record`, `undo`, `redo`, `clear`, `canUndo`, `canRedo` |
| Auto-save | Vue : un `watch` profond sur `columnStates / activeSorts / filterModel` appelle `save(persistKey)`. Angular : un `effect` racine fait pareil. |
| Auto-restore | Premier mount, avant le rendu initial : `restore(persistKey)` est appelé ; s'il retourne `false` (pas d'entrée sauvegardée ou erreur de parse), les valeurs par défaut sont conservées. |

### Contrat d'implémentation (interne)

- Le moteur de persistance ne planifie jamais son propre timer — il persiste
  de manière synchrone à chaque écriture d'état. Lisser à travers les rechargements est le boulot de
  la couche storage, pas du moteur.
- La restauration mute `state.columnStates`, `state.activeSorts`,
  `state.filterModel` en une passe. Elle NE touche PAS au groupement, à l'expansion,
  ni à la sélection.
- Ordre de restauration : colonnes → tris (avec recompute de `sortIndex`) → filtres
  (avec `id` frais).

### Mapping Vue

- Moteur : `apps/grid-vue/.../Grid/features/useStatePersistenceEngine.ts`.
- Composable : `useStatePersistenceEngine(state) → { save, restore, clear }`.
- Historique : `useHistoryEngine.ts`. `STORAGE_PREFIX = 'adeo-grid-history:'`,
  `MAX_HISTORY = 50`.
- Câblage : voir le bloc props `persistKey` / `historyId` d'`Grid.vue`
  (lignes ~234-260) et le watch d'attach d'historique (lignes ~1006-1020).

### Mapping Angular

- Moteur : `apps/grid-angular/.../grid/features/state-persistence.engine.ts`
  (`@Injectable() StatePersistenceEngine<T>`).
- Historique : `history.engine.ts`, mêmes préfixe et cap que Vue. Site d'appel
  d'`attach` : `grid.ts` ligne ~1187 dans un `effect()`.
- Câblage : `grid.ts` déclare `persistKey` en tant qu'`input()` et monte
  l'effect.

## Notes transverses

- **Pas de registres globaux**. Les renderers sont projetés par colonne ; les plugins sont
  passés par grille ; les fonctions de formule sont par moteur via `setFunctions`. La
  librairie ne lit jamais depuis `window` ni un singleton.
- **Le sucre côté démo vit dans `app/renderers/`**. Tout ce qui wrappe des composants
  Mozaic dans une factory de renderer y a sa place. La promesse de la librairie
  est la *jointure de projection*, pas un catalogue pré-cuit.
- **La persistance est best-effort, jamais bloquante**. Les moteurs qui touchent à
  `localStorage` (`state-persistence`, `history`) encapsulent tous les accès dans
  un `try / catch` et dégradent silencieusement.
- **Streaming là où ça compte**. L'export utilise `TransformStream` pour éviter
  d'allouer >1 Go de string sur des exports 100k × 150 colonnes. L'évaluation de formules
  parcourt un DAG, jamais l'intégralité de la grille.

Fin du chapitre.
