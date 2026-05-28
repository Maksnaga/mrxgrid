<script setup lang="ts">
/**
 * Filtre custom AG-Grid sur la colonne `category` (Rayon).
 *
 * Implémente le contrat documenté dans `models/filter.model.ts` :
 *  - reçoit un seul prop `params: MrxFilterParams<…>` qui bundle
 *    `{ model, column, filterParams, getValue, onModelChange }`
 *  - expose via `defineExpose` les hooks optionnels que le builder /
 *    column overlay appellent : `isFilterActive`, `refresh`, `getModelAsString`
 *
 * Le prédicat (`doesFilterPass`) est déclaré EN DEHORS du composant, dans
 * le ColumnDef, parce que c'est de la donnée de colonne. Voir
 * `DemoPage.vue` pour le wiring.
 */

import { computed, ref } from 'vue'
import { MCombobox } from '@mozaic-ds/vue'
import type { MrxFilterParams } from '@/components/MrxGrid'
import type { LMProduct } from '../../mock/seed'

const props = defineProps<{
  params: MrxFilterParams<LMProduct, string[]>
}>()

// État local — la grille est source de vérité (`params.model`), on syncro
// via `refresh()` quand le model change depuis l'extérieur (drawer apply,
// persistView restore).
const model = ref<string[]>(
  Array.isArray(props.params.model) ? props.params.model : [],
)

// Les options viennent de `filterParams` (passées par la ColumnDef). Le
// composant reste découplé du dataset — n'importe quel autre catalogue
// peut le réutiliser avec ses propres rayons.
const options = computed(() => {
  const raw = props.params.filterParams
  if (!Array.isArray(raw)) return []
  return raw.map((label) => ({ label, value: label }))
})

function onUpdate(value: string | number | (string | number)[] | null): void {
  const next = Array.isArray(value)
    ? (value as string[])
    : value == null
      ? []
      : [String(value)]
  model.value = next
  // `null` signale "filtre inactif" — la grille drop la condition.
  props.params.onModelChange(next.length === 0 ? null : next)
}

defineExpose({
  isFilterActive: () => model.value.length > 0,
  refresh: (newParams: MrxFilterParams<LMProduct, string[]>): boolean => {
    model.value = Array.isArray(newParams.model) ? newParams.model : []
    return true
  },
  getModelAsString: (m: string[]) =>
    Array.isArray(m) && m.length > 0 ? m.join(', ') : '',
})
</script>

<template>
  <MCombobox
    :id="`filter-category-${(params.column as { field: string }).field}`"
    multiple
    search
    clearable
    size="s"
    placeholder="Choisir un rayon…"
    :options="options"
    :model-value="model"
    @update:model-value="onUpdate"
  />
</template>
