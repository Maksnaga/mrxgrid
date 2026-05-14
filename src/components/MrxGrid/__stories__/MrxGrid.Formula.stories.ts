import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { MrxGrid, MrxFormulaBar } from '@/components/MrxGrid'
import type { CellEditEvent, ColumnDef, RowData } from '@/components/MrxGrid'

const meta = {
  title: 'Stories/Formula Engine/Basics · Custom functions · Refs',
  component: MrxGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
# Formula engine

Active dès qu'au moins une colonne déclare \`allowFormula: true\`. Détecte automatiquement les strings commençant par \`=\` dans \`props.rows\`, les évalue via un DAG topologique, et re-évalue les dépendants à chaque édit upstream.

### Capacités

- Refs A1 (\`=A1\`, \`=B2+C3\`)
- Refs par nom de champ (\`=[qty]*[price]\`)
- Ranges (\`=SUM(A1:A10)\`)
- Mélange refs absolues / relatives (\`$A1\`, \`A$1\`, \`$A$1\`)
- Built-in functions: \`SUM, AVG, MIN, MAX, COUNT, IF, ROUND, ABS, …\`
- Erreurs typées : \`#DIV/0!\`, \`#REF!\`, \`#NAME?\`, \`#CIRCULAR!\`

### UX en mode tableur

Quand le formula engine est actif, la grille bascule visuellement :
- Strip A/B/C/D dans le header
- Numéros de ligne sticky à gauche
- Éditeur \`contenteditable\` avec coloration syntaxique
- F4 sur une ref au curseur → cycle \`A1\` → \`$A$1\` → \`A$1\` → \`$A1\`
- Click pendant édition → insère la ref au curseur
- Drag → insère un range

### Composants associés

- \`<MrxFormulaBar>\` — barre de formule type Excel, en haut de la grille
- \`<MrxFormulaReferenceDrawer>\` — popup help avec la liste des fonctions

### API impérative

\`\`\`ts
grid.setFormula(rowId, field, '=A1+B1')   // set programmatique
grid.getFormula(rowId, field)              // returns the source formula
grid.getFormulaValue(rowId, field)          // returns the evaluated value
\`\`\`
        `,
      },
    },
  },
} satisfies Meta<typeof MrxGrid>

export default meta
type Story = StoryObj<typeof meta>

interface OrderRow extends RowData {
  id: number
  product: string
  qty: number
  price: number
  subtotal: string
  vat: string
  total: string
}

function makeOrders(): OrderRow[] {
  const products = ['Tondeuse', 'Perceuse', 'Robinet', 'Carrelage', 'Pinceau', 'Cadenas']
  return products.map((p, i) => ({
    id: i + 1,
    product: p,
    qty: (i + 1) * 2,
    price: 19.9 + i * 12,
    // Same-row formulas — refer to fields by name.
    subtotal: '=[qty]*[price]',
    vat: '=[subtotal]*0.20',
    total: '=[subtotal]+[vat]',
  }))
}

export const SameRowFormulas: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Same-row formulas

\`=[qty]*[price]\` réfère par **nom de champ** dans la même ligne. Plus lisible que les coordonnées A/B/C quand vos colonnes ont des noms domain.

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = [
  { field: 'qty',      editable: true, cellEditor: 'number' },
  { field: 'price',    editable: true, cellEditor: 'number' },
  { field: 'subtotal', editable: true, allowFormula: true },
  { field: 'vat',      editable: true, allowFormula: true },
  { field: 'total',    editable: true, allowFormula: true },
]

const rows = [
  { id: 1, qty: 2, price: 100, subtotal: '=[qty]*[price]', vat: '=[subtotal]*0.20', total: '=[subtotal]+[vat]' },
]
\`\`\`

### Topological eval

Le moteur construit un DAG des dépendances. Si \`vat\` dépend de \`subtotal\` qui dépend de \`qty\`/\`price\`, éditer \`qty\` re-calcule **subtotal puis vat puis total** dans cet ordre — pas d'oscillation, pas de re-calcul redondant.

### Cycle detection

\`A = '=B'\` et \`B = '=A'\` → les deux cellules affichent \`#CIRCULAR!\` avec tooltip d'explication. Pas de stack overflow, pas de freeze.

### Pourquoi un \`row-id\` stable est obligatoire

Le DAG est indexé par \`(rowId, field)\` — sans \`rowId\`, le moteur perd le mapping au sort/filter et toutes les formules cassent.
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid, MrxFormulaBar },
    setup() {
      const cols: ColumnDef[] = [
        { field: 'id', headerName: 'ID', width: '60px', pinned: 'start' },
        { field: 'product', headerName: 'Produit', width: '160px', editable: true },
        { field: 'qty', headerName: 'Qté', width: '90px', editable: true, cellEditor: 'number' },
        { field: 'price', headerName: 'Prix', width: '110px', editable: true, cellEditor: 'number' },
        { field: 'subtotal', headerName: 'Sous-total (=)', width: '160px', editable: true, allowFormula: true },
        { field: 'vat', headerName: 'TVA 20% (=)', width: '160px', editable: true, allowFormula: true },
        { field: 'total', headerName: 'Total (=)', width: '160px', editable: true, allowFormula: true },
      ]
      const rows = ref<OrderRow[]>(makeOrders())

      const gridRef = ref<InstanceType<typeof MrxGrid>>()
      const barRef = ref<InstanceType<typeof MrxFormulaBar>>()

      function onCellEdit(e: CellEditEvent) {
        const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (!row) return
        if (e.field === 'qty' || e.field === 'price') {
          const n = Number(e.newValue)
          row[e.field] = Number.isFinite(n) ? n : e.newValue
        } else {
          row[e.field] = e.newValue
        }
      }

      return { cols, rows, gridRef, barRef, onCellEdit }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Same-row formulas (<code>allowFormula: true</code>)</h2>
        <p>
          Dès qu'une colonne a <code>allowFormula: true</code>, le grid passe en
          <strong>mode tableur</strong> : strip A/B/C dans le header, numéros de ligne sticky
          à gauche, éditeur <em>contenteditable</em> avec coloration syntaxique.
        </p>
        <ul style="font-size:12px;color:#4a5364;margin-top:0">
          <li>Tape <code>=D5</code> ou <code>=[qty]*[price]</code> — chaque ref s'allume avec une couleur unique sur la cellule cible</li>
          <li><strong>Click</strong> sur une cellule pendant l'édition → insère sa ref au curseur</li>
          <li><strong>Drag</strong> de cellule en cellule → insère un range <code>A1:B5</code></li>
          <li><strong>F4</strong> sur la ref au curseur → cycle <code>A1</code> → <code>$A$1</code> → <code>A$1</code> → <code>$A1</code></li>
          <li>Erreurs de calcul (<code>#DIV/0!</code>, <code>#REF!</code>…) rendues en rouge avec tooltip</li>
        </ul>
        <MrxFormulaBar ref="barRef" :all-columns="cols" :rows="rows" />
        <div class="sb-mrx-frame">
          <MrxGrid :height="560"
            ref="gridRef"
            :columns="cols"
            :rows="rows"
            :row-id="(r) => String(r.id)"
            @cell-edit="onCellEdit"
          />
        </div>
      </div>
    `,
  }),
}

export const CrossRowReferences: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Cross-row references (\`=A1\`, \`=B2+C3\`)

Le moteur supporte les coordonnées A1 entre lignes — même sémantique qu'Excel/Sheets.

### Syntaxe

| Forme | Sens |
|-------|------|
| \`=A1\` | Cellule colonne A, ligne 1 (1-indexed) |
| \`=$A1\` | Colonne absolue, ligne relative |
| \`=A$1\` | Colonne relative, ligne absolue |
| \`=$A$1\` | Tout absolu |
| \`=A1:B5\` | Range rectangulaire |
| \`=SUM(A1:A10)\` | Function sur une range |

### Pattern "running total"

\`\`\`
| ID | Qté | Cumul        |
| 1  | 2   | =C1          |   ← C = colonne 'qty'
| 2  | 4   | =E1+C2       |   ← E = colonne 'cumul' (ligne précédente) + qty courante
| 3  | 6   | =E2+C3       |
\`\`\`

### F4 absolute toggle

Pendant l'édition d'une formule, placez le curseur sur une ref et appuyez F4 — cycle \`A1\` → \`$A$1\` → \`A$1\` → \`$A1\`. Idéal pour copier une formule sur plusieurs lignes en gardant certaines refs fixes.

### Notes

- Le moteur ne supporte PAS les inter-grilles (refs vers une autre instance)
- Le moteur ne supporte PAS les feuilles multiples (pas de \`=Sheet1!A1\`)
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid, MrxFormulaBar },
    setup() {
      const cols: ColumnDef[] = [
        { field: 'id', headerName: 'ID', width: '60px', pinned: 'start' },
        { field: 'product', headerName: 'Produit', width: '180px', editable: true },
        { field: 'qty', headerName: 'Qté', width: '100px', editable: true, cellEditor: 'number' },
        { field: 'price', headerName: 'Prix', width: '110px', editable: true, cellEditor: 'number' },
        { field: 'cumulated', headerName: 'Cumul Qté (=)', width: '180px', editable: true, allowFormula: true },
      ]
      const rows = ref<RowData[]>([
        { id: 1, product: 'Tondeuse', qty: 2, price: 199, cumulated: '=C1' },
        { id: 2, product: 'Perceuse', qty: 4, price: 99,  cumulated: '=E1+C2' },
        { id: 3, product: 'Robinet',  qty: 6, price: 49,  cumulated: '=E2+C3' },
        { id: 4, product: 'Carrelage', qty: 8, price: 29, cumulated: '=E3+C4' },
      ])

      function onCellEdit(e: CellEditEvent) {
        const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (!row) return
        if (e.field === 'qty' || e.field === 'price') {
          row[e.field] = Number(e.newValue) || e.newValue
        } else {
          row[e.field] = e.newValue
        }
      }

      return { cols, rows, onCellEdit }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Cross-row references (<code>=A1</code>, <code>=B2+C3</code>…)</h2>
        <p>Le moteur supporte les références A1 entre lignes. Edite la cellule "Cumul" → la barre formule affiche la formule originale, le grid affiche la valeur évaluée.</p>
        <div class="sb-mrx-frame">
          <MrxGrid :height="560" :columns="cols" :rows="rows" :row-id="(r) => String(r.id)" @cell-edit="onCellEdit" />
        </div>
      </div>
    `,
  }),
}
