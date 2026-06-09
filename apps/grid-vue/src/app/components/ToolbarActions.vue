<script setup lang="ts">
/**
 * Actions consumer placées dans le slot `#toolbar` du grid.
 *
 * Pattern à reproduire dans une app réelle : on garde la toolbar
 * built-in du grid (fullscreen / filters / settings / group / keyboard /
 * export CSV) et on ajoute nos propres actions métier à côté.
 *
 * Recherche debouncée — bindée en v-model sur l'input live, le watcher
 * du parent observera la valeur debounced (300 ms par défaut côté
 * `useDebouncedRef`).
 */

import { MIconButton, MTextInput, MButton } from '@mozaic-ds/vue'
import {
  AdGridToolbar,
  type ColumnDef,
  type GroupingItem,
  type FilterModel,
  type DataDensity,
} from '@/components/Grid'
import {
  Download24,
  Search24,
  Upload24,
} from '@mozaic-ds/icons-vue'

/**
 * Le grid ref est typé comme un objet libre — la smart toolbar narrow
 * elle-même au sous-ensemble dont elle a besoin (`exportCsv`,
 * `setFilterModel`, …). Plus pratique que d'importer le type interne
 * et plus tolérant aux variantes (StockDemo grid, mini-grid embedded, …).
 */
defineProps<{
  search: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grid: any
  columns: ColumnDef[]
  fullscreen: boolean
  density: DataDensity
  hiddenFields: string[]
  columnOrder: string[] | undefined
  activeGroups: GroupingItem[]
  filterModel: FilterModel
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:fullscreen': [value: boolean]
  'update:density': [value: DataDensity]
  'update:hidden-fields': [value: string[]]
  'update:column-order': [value: string[] | undefined]
  'update:active-groups': [value: GroupingItem[]]
  'update:filter-model': [value: FilterModel]
  'new-product': []
  'import-csv': []
}>()
</script>

<template>
  <div class="toolbar-actions">
    <!-- Recherche live à gauche — debouncée par le parent. -->
    <div class="toolbar-actions__search">
      <MTextInput id="demo-search" size="s" input-type="search"
        placeholder="Rechercher un produit, une marque, une réf…" :model-value="search"
        @input="(e: Event) => emit('update:search', (e.target as HTMLInputElement).value)">
        <template #icon>
          <Search24 />
        </template>
      </MTextInput>
    </div>

    <!-- Smart toolbar Mozaic — wraps fullscreen / filters / settings / group / keyboard / export -->
    <ad-grid-toolbar :grid="grid" :columns="columns" :fullscreen="fullscreen" :density="density"
      :hidden-fields="hiddenFields" :column-order="columnOrder" :active-groups="activeGroups"
      :filter-model="filterModel" :show-fullscreen="true" :show-export="true" :show-settings="true" :show-filters="true"
      :show-group="true" :show-keyboard="true" export-filename="catalogue"
      @update:fullscreen="(v: boolean) => emit('update:fullscreen', v)"
      @update:density="(v: DataDensity) => emit('update:density', v)"
      @update:hidden-fields="(v: string[]) => emit('update:hidden-fields', v)"
      @update:column-order="(v: string[] | undefined) => emit('update:column-order', v)"
      @update:active-groups="(v: GroupingItem[]) => emit('update:active-groups', v)"
      @update:filter-model="(v: FilterModel) => emit('update:filter-model', v)" />

    <!-- Actions consumer à droite — patterns SaaS classiques. -->
    <div class="toolbar-actions__cta">
      <MIconButton ghost size="s" aria-label="Importer un CSV" title="Importer un CSV" @click="emit('import-csv')">
        <template #icon>
          <Upload24 />
        </template>
      </MIconButton>

      <MIconButton ghost size="s" aria-label="Exporter" title="Exporter">
        <template #icon>
          <Download24 />
        </template>
      </MIconButton>

      <MButton size="s" appearance="accent" @click="emit('new-product')">
        + Nouveau produit
      </MButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}

.toolbar-actions__search {
  flex: 1 1 280px;
  min-width: 240px;
  max-width: 360px;
}

.toolbar-actions__cta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
</style>
