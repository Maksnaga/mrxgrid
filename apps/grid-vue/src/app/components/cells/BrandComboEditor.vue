<script setup lang="ts">
/**
 * Éditeur de cellule custom — `MCombobox` Mozaic monté via le slot
 * `#edit-{field}` du grid.
 *
 * Pattern : on lit la valeur courante via la prop `editValue` du slot,
 * on émet via `updateValue(v)` à chaque sélection ET on appelle
 * `commit('down')` pour fermer l'edit + mover la cell active d'une row
 * vers le bas (UX Excel-like). `cancel()` est câblé sur Escape (le
 * keydown remonte au composable d'édition par défaut, donc rien à
 * faire ici sauf si on veut une logique custom).
 *
 * Les options sont passées par la colonne via `cellEditorOptions`
 * (`{ value, label }[]`) pour rester compatible avec l'API ColumnDef
 * standard du grid — on n'invente pas de prop ad-hoc.
 */

import { computed } from 'vue'
import { MCombobox } from '@mozaic-ds/vue'
import type { ColumnDef } from '@/components/AdeoGrid'

const props = defineProps<{
  /** Champ de la colonne (utilisé pour générer un id stable). */
  field: string
  /** Index de la row courante (idem). */
  rowIndex: number
  /** Définition complète de la colonne — on lit `cellEditorOptions` ici. */
  column: ColumnDef
  /** Valeur en cours d'édition. Source de vérité côté grid. */
  editValue: unknown
  /** Push une nouvelle valeur dans le draft du grid. */
  updateValue: (v: unknown) => void
  /**
   * Termine l'édition. `'stay'` commit sans déplacer l'active cell — c'est
   * ce qu'on utilise pour le combobox : tu vois le shimmer apparaître sur
   * la cell que tu viens de modifier au lieu d'être projeté une row plus
   * bas. `'down'` / `'right'` / `'left'` font le mouvement Excel-like.
   */
  commit: (dir?: 'down' | 'right' | 'left' | 'stay') => void
}>()

/**
 * Cast en `ListboxOption[]` attendu par MCombobox. On accepte le shape
 * `{ value, label }` du ColumnDef et on remap vers `{ value, label }`
 * (compat 1-pour-1, juste typage). `searchable: true` ajoute le champ
 * de recherche dans le listbox — utile dès qu'on a > 10 options.
 */
const options = computed(() =>
  (props.column.cellEditorOptions ?? []).map((o) => ({
    label: o.label,
    value: o.value as string | number,
  })),
)

function onUpdate(v: string | number | null | (string | number)[]): void {
  // MCombobox émet `string | number | null | (string|number)[]` selon
  // `multiple`. Ici on est en single — on normalise `null → ''` pour
  // ne pas casser le grid qui comparait `oldValue === newValue`.
  const next = Array.isArray(v) ? v[0] : v
  props.updateValue(next ?? '')
  // `'stay'` pour que la cellule éditée reste active après commit — l'œil
  // de l'utilisateur reste posé dessus, le shimmer "pending" est donc
  // bien perçu. Sans ça, `commit('down')` projetterait sur la row
  // suivante et le shimmer apparaîtrait hors du champ visuel.
  props.commit('stay')
}
</script>

<template>
  <MCombobox
    :id="`adeo-grid-cell-combo-${field}-${rowIndex}`"
    size="s"
    searchable
    clearable
    :options="options"
    :model-value="(editValue as string | number | null) ?? null"
    class="brand-combo-editor"
    @update:model-value="onUpdate"
  />
</template>

<style scoped lang="scss">
.brand-combo-editor {
  // L'éditeur doit remplir la cellule (sinon il flotte au-dessus du
  // texte précédent et clipping bizarre au scroll). `min-width: 0` pour
  // qu'il puisse rétrécir sous sa taille intrinsèque dans une cellule
  // étroite.
  width: 100%;
  min-width: 0;
}
</style>
