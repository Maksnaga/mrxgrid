# Virtualization

> Comment afficher 100 000 lignes × 200 colonnes sans tuer le DOM.

## Principe

Le DOM est lent : 1 000 nœuds = 1 frame, 100 000 nœuds = 30 secondes de freeze. La solution : **ne rendre que ce qui est visible**. Grid virtualise **toujours** sur les deux axes — vertical (lignes) et horizontal (colonnes). C'est l'engine par défaut, aucun input à activer côté consommateur. Sur les petits datasets, les engines sont des no-ops (coût négligeable).

Côté Vue : composables `useVirtualScroll`, `useVirtualColumns`, `useVirtualGrid`.
Côté Angular : engines `VerticalVirtualScrollEngine`, `HorizontalVirtualScrollEngine`.

## Vertical — comment ça marche

```
Wrapper            (overflow: auto, fixed height H)
┌────────────────────────────────────────┐  ▲
│ ╔════════════════════════════════╗ │   │
│ ║       Sticky header            ║ │   │
│ ╚════════════════════════════════╝ │   │ scroll =
│                                    │   │ wrapper.scrollTop
│ Body sizer (height = N × rowH)     │   │
│ ┌──────────────────────────────────┐ │ │
│ │  Top spacer (offsetY px)         │   │  ▼
│ ├──────────────────────────────────┤
│ │  Row[start]                          │  ← rendu
│ │  Row[start+1]                        │  ← rendu
│ │   …                                  │
│ │  Row[end]                            │  ← rendu
│ ├──────────────────────────────────┤
│ │  Bottom space (sizer fills)          │
│ └──────────────────────────────────┘
└────────────────────────────────────────┘

  rowsRendered = end − start  (capé à 80, voir plus bas)
  start        = floor(scrollTop / rowHeight) − overscan
  end          = ceil((scrollTop + H) / rowHeight) + overscan
  offsetY      = start × rowHeight  ← top spacer height
```

### Détails clés

| Décision | Raison |
|---|---|
| **Index-based, pas array-based** | `visibleRange` est un `[start, end]` int. Le rendu fait un `for` sur le range + `getRow(i)`. Pas d'allocation d'array `.slice()` à chaque scroll → 0 GC pressure. |
| **Top spacer en height, pas en transform** | `translateY()` crée un containing block qui piège `position: sticky`. Les colonnes pinned cesseraient d'être collées. On utilise un `div` de hauteur `offsetY` à la place. |
| **Cap à 80 lignes max** | En densité compact (25px), un viewport 600px contient 24 lignes. Avec overscan 5 de chaque côté, on rend 34. Le cap protège contre des resize qui voudraient rendre 200+ lignes (Mac touchpad inertia). |
| **scrollTop clampé quand le contenu rétrécit** | Si l'utilisateur scrolle à 80 000 puis active le groupage qui réduit à 4 lignes, on doit forcer `scrollTop = 0` sinon le browser garde la valeur invalide. |
| **rowHeight reactif** | Density change → `rowHeight` de 25 → 37 → 45. Le spacer top ajuste sa hauteur, la position de scroll est *préservée proportionnellement* (premier visible reste stable). |
| **`totalCount` distinct de `rows.length`** | En lazy loading, on connaît le total côté serveur (`50_000`) avant de tout charger. `totalCount` dimensionne la scrollbar pour qu'elle ne saute pas quand de nouvelles pages arrivent. |

## Horizontal — virtualisation des colonnes

Même principe sur l'axe X : l'engine horizontal calcule un `[colStart, colEnd]` basé sur `scrollLeft` et les largeurs cumulées des colonnes. Les **colonnes pinned (start/end) sont toujours rendues** — elles sont en `position: sticky`, donc visibles peu importe le scroll horizontal.

```
        ◀── scrollLeft ──▶
┌──────┬──────────────────────────────────────────────┬──────┐
│PIN(s)│ <— virtual slice (only visible columns) —→   │PIN(e)│
└──────┴──────────────────────────────────────────────┴──────┘
   ▲                                                     ▲
   ├ position: sticky; left:  0                          ├ position: sticky; right: 0
   └ always rendered                                     └ always rendered
```

> La virtualisation horizontale étant toujours active, le mécanisme « dernière colonne flex » est **désactivé** dès que la slice change pendant le scroll : faire grossir la dernière colonne visible créerait des sauts de largeur à chaque mouvement.

## Variable height (lignes de tailles différentes)

Pour les rows qui se déplient, les groupes ou les detail rows, la hauteur n'est pas uniforme. La couche variable-height maintient un cache **rolling** des hauteurs mesurées.

### Vue

```ts
import { useVariableHeightVirtualScroll } from '@adeo/grid-vue'

const v = useVariableHeightVirtualScroll({
  totalCount: () => rows.value.length,
  estimatedRowHeight: 37,         // valeur initiale, ajustée par mesure réelle
  containerRef: wrapperRef,
  scrollTop: () => wrapperRef.value?.scrollTop ?? 0,
})

// l'utilisateur expand une row → v.recomputeHeight(rowIndex, newHeight)
```

### Angular

```ts
import { inject } from '@angular/core'
import { VerticalVirtualScrollEngine } from '@adeo/grid-angular'

const v = inject(VerticalVirtualScrollEngine)
v.configure({
  totalCount: () => rows().length,
  estimatedRowHeight: 37,
  containerRef: wrapperRef,
  scrollTop: () => wrapperRef.nativeElement?.scrollTop ?? 0,
})

// l'utilisateur expand une row → v.recomputeHeight(rowIndex, newHeight)
```

L'algorithme est en O(log N) via une `BinaryIndexedTree` (Fenwick), donc même sur 100k lignes le `getRowOffset(i)` reste rapide.

> Pour les expandable rows en particulier, la hauteur de la ligne de détail est mesurée automatiquement via `ResizeObserver`. Pas besoin de la déclarer côté consommateur — voir le chapitre **Spec / Lignes dépliables**.

## Pinned columns + virtualisation

Le layout est délicat : les colonnes pinned sont **en dehors** de la slice virtuelle (toujours rendues), mais doivent rester sticky **dans le wrapper**, pas relativement à la fenêtre. Pour ça :

- Le `.grid-row` a `min-width: max(100%, contentMinWidth)` — la rangée est au moins aussi large que le wrapper
- Le `.grid-cell--pinned` a `position: sticky` + un offset calculé selon le cumul des colonnes précédentes
- Pas de `transform` sur les ancêtres (sinon containing block trap, voir plus haut)

## Caractéristiques observées

| Scénario | Lignes | Cols | FPS scroll | Mémoire DOM |
|---|---|---|---|---|
| Standard | 1 000 | 20 | 60 | ~2 MB |
| Big data | 100 000 | 20 | 60 | ~3 MB (slice constante) |
| Many cols | 100 | 200 | 60 | ~3 MB |
| 2D extreme | 50 000 | 100 | ~58 | ~4 MB |

*Mesuré sur Apple M2, Chrome 130, viewport 1500×900, density default.*

## Knobs disponibles

La virtualisation est toujours active — il n'y a rien à activer. Les seuls inputs qui restent pour la régler :

| Input | Rôle |
|---|---|
| `containerHeight` | Hauteur du viewport en px (défaut 600) — bornes la fenêtre que l'engine vertical mesure. |
| `overscan` | Lignes rendues au-dessus / en-dessous du viewport (défaut 5). |
| `columnOverscan` | Colonnes rendues à gauche / à droite du viewport horizontal (défaut 2). |
| `totalItems` | Total côté serveur en lazy loading — dimensionne la scrollbar pour qu'elle ne saute pas quand de nouvelles pages arrivent. |
| `onVisibleRangeChange` (Vue) / `loadMore` (Angular) | Callback de plage visible, à brancher sur ton fetch paginé. |
| API variable-height (`useVariableHeightVirtualScroll` Vue / engine vertical Angular) | Datasets avec hauteurs hétérogènes (detail rows, group rows…). |

## Pièges connus

### 1. Le scroll ne fonctionne pas / la grid déborde son parent

Si le grid est dans un parent à hauteur fixe et `overflow:hidden`, le contenu peut être coupé sans scroll. Wrap dans un `display: flex; flex-direction: column` → `flex: 1; min-height: 0` sur le grid root prend le relais (déjà géré).

### 2. Pinned columns « décollent » au scroll

Probablement un `transform` ou `filter` sur un ancêtre. Vérifie via Chrome DevTools → Computed → *Containing block*. La colonne pinned doit avoir le wrapper comme containing block, pas un container intermédiaire.

### 3. Saut de scroll quand les données arrivent (lazy)

Passe `totalItems="50000"` dès le départ pour fixer la taille du sizer, même si `rows.length` est 0 au début.
