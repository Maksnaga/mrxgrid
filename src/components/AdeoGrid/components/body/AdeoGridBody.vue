<script setup lang="ts">
/**
 * Grid body — Angular parity (`moz-grid-body`).
 *
 * Extracted from `AdeoGrid.vue` to isolate the body rendering (virtual sizer,
 * top spacer, per-row alternation between group headers and data rows, detail
 * rows). The parent grid keeps ownership of the scroll container, sticky
 * header and all the composables — the body is a presentational leaf that
 * receives:
 *
 *   - layout primitives (`totalHeight`, `offsetY`, `renderRange`, widths)
 *   - row accessors (`getRenderRow`, `isExpanded`, `isRowSelected`, …)
 *   - cell helpers (`getCellFlags`, `getColumnWidth`, `getPinnedStyle`, …)
 *
 * It emits row-level events augmented with the row index, so the parent can
 * keep its existing handlers mostly unchanged.
 *
 * Both the virtual and non-virtual body variants are rendered here, switched
 * on the `virtual` prop. Mutually exclusive.
 */

import type { CSSProperties } from 'vue'
import type { CellFlags, ColumnDef, RowData } from '../../types'
import { isGroupRow } from '../../types'
import AdeoGridRow from './AdeoGridRow.vue'
import AdeoGridGroupRow from './AdeoGridGroupRow.vue'
import AdeoGridDetailRow from './AdeoGridDetailRow.vue'

defineProps<{
  /** Use the virtual-scroll variant (sizer + top spacer). */
  virtual: boolean
  /** Min-width applied to the body wrappers so pinned columns have room. */
  gridContentWidth?: string
  /** Total height of the virtual sizer (virtual mode only). */
  totalHeight: number
  /** Top-spacer height pushing the rendered slice down (virtual mode only). */
  offsetY: number
  /** Indices of the rows to render this tick. */
  renderRange: number[]

  /** Center (unpinned) columns — may be a virtualized slice. */
  columns: ColumnDef[]
  leftColumns: ColumnDef[]
  rightColumns: ColumnDef[]
  hasPinned: boolean
  selectable?: boolean
  expandable?: boolean

  /** Return the row/group-row for a given `renderRange` index. */
  getRenderRow: (index: number) => RowData

  /** Row-state queries. */
  isRowSelected: (row: RowData, index: number) => boolean
  isExpanded: (index: number) => boolean
  /** True quand la row a une mutation en vol — drive le dim row-level. */
  isRowPending?: (row: RowData, index: number) => boolean
  isGroupExpanded: (key: string) => boolean
  activeFieldForRow: (index: number) => string | null | undefined
  editingFieldForRow: (index: number) => string | null | undefined
  /** Draft value of the currently-editing cell, if any. */
  editingDraft?: unknown

  /** Cell helpers. */
  getCellFlags?: (rowIndex: number, field: string) => CellFlags
  getColumnWidth?: (field: string) => string | undefined
  getPinnedStyle: (side: 'left' | 'right', index: number, isHeader: boolean) => CSSProperties
  getUtilityStyle: (
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ) => CSSProperties | undefined
  showRowNumbers?: boolean
  leftSpacerWidth?: string
  rightSpacerWidth?: string
  /** Field of the last unpinned column to flex-fill the trailing gap. */
  fillField?: string | null
}>()

const emit = defineEmits<{
  toggleSelect: [index: number, event?: MouseEvent]
  toggleExpand: [index: number]
  activateCell: [index: number, field: string, event: MouseEvent]
  editStart: [index: number, field: string]
  editInput: [value: unknown]
  editCommit: [direction: 'down' | 'right' | 'left' | 'stay']
  editCancel: []
  editBlur: []
  fillHandleMousedown: [event: MouseEvent]
  toggleGroup: [key: string]
  /**
   * Propagated from `AdeoGridDetailRow` whenever a detail row's intrinsic
   * height is measured. The parent grid stores this to feed the virtual
   * scroller's `expandedRowExtraHeight` dynamically — no need for the
   * consumer to pass `:expanded-row-height` matching the slot content.
   */
  detailRowMeasured: [height: number]
}>()
</script>

<template>
  <!-- Virtual scroll body -->
  <div
    v-if="virtual"
    class="mrx-grid-body"
    :style="{ minWidth: gridContentWidth ? `max(100%, ${gridContentWidth})` : '100%' }"
  >
    <!--
      Sizer: height = totalCount × rowHeight. Sets the scrollbar height.
      The top-spacer pushes rows to their correct scroll position WITHOUT
      using `transform` (which would create a containing block that traps
      `position: sticky` children, breaking pinned columns).
    -->
    <div class="mrx-grid-sizer" :style="{ height: `${totalHeight}px` }">
      <div
        v-if="offsetY > 0"
        class="mrx-grid-top-spacer"
        :style="{ height: `${offsetY}px` }"
      />

      <template v-for="i in renderRange" :key="i">
        <template v-if="isGroupRow(getRenderRow(i))">
          <AdeoGridGroupRow
            :header-name="String(getRenderRow(i).__mrxHeaderName)"
            :value="getRenderRow(i).__mrxValue"
            :count="Number(getRenderRow(i).__mrxCount)"
            :depth="Number(getRenderRow(i).__mrxDepth)"
            :expanded="isGroupExpanded(String(getRenderRow(i).__mrxKey))"
            :columns="columns"
            :pinned-left-columns="leftColumns"
            :pinned-right-columns="rightColumns"
            :has-pinned="hasPinned"
            :selectable="selectable"
            :expandable="expandable"
            :show-row-numbers="showRowNumbers"
            :get-column-width="getColumnWidth"
            :get-pinned-style="getPinnedStyle"
            :get-utility-style="getUtilityStyle"
            :left-spacer-width="leftSpacerWidth"
            :right-spacer-width="rightSpacerWidth"
            @toggle="emit('toggleGroup', String(getRenderRow(i).__mrxKey))"
          />
        </template>
        <template v-else>
          <AdeoGridRow
            :row="getRenderRow(i)"
            :row-index="i"
            :columns="columns"
            :pinned-left-columns="leftColumns"
            :pinned-right-columns="rightColumns"
            :has-pinned="hasPinned"
            :selectable="selectable"
            :selected="isRowSelected(getRenderRow(i), i)"
            :pending="isRowPending ? isRowPending(getRenderRow(i), i) : false"
            :expandable="expandable"
            :expanded="isExpanded(i)"
            :active-field="activeFieldForRow(i)"
            :editing-field="editingFieldForRow(i)"
            :edit-value="editingDraft"
            :get-cell-flags="getCellFlags"
            :get-column-width="getColumnWidth"
            :get-pinned-style="getPinnedStyle"
            :get-utility-style="getUtilityStyle"
            :show-row-numbers="showRowNumbers"
            :row-number="i + 1"
            :left-spacer-width="leftSpacerWidth"
            :right-spacer-width="rightSpacerWidth"
            :fill-field="fillField"
            @toggle-select="(e?: MouseEvent) => emit('toggleSelect', i, e)"
            @toggle-expand="emit('toggleExpand', i)"
            @activate-cell="(field: string, e: MouseEvent) => emit('activateCell', i, field, e)"
            @edit-start="(field: string) => emit('editStart', i, field)"
            @edit-input="(v: unknown) => emit('editInput', v)"
            @edit-commit="(d: 'down' | 'right' | 'left' | 'stay') => emit('editCommit', d)"
            @edit-cancel="emit('editCancel')"
            @edit-blur="emit('editBlur')"
            @fill-handle-mousedown="(e: MouseEvent) => emit('fillHandleMousedown', e)"
          >
            <template v-if="$slots.cell" #cell="cellSlot">
              <slot name="cell" v-bind="cellSlot" />
            </template>
          </AdeoGridRow>
          <AdeoGridDetailRow
            v-if="expandable && isExpanded(i)"
            @measure="(h: number) => emit('detailRowMeasured', h)"
          >
            <slot name="expand-row" :row="getRenderRow(i)" :index="i" />
          </AdeoGridDetailRow>
        </template>
      </template>
    </div>
  </div>

  <!-- Non-virtual body (plain flex list, no sizer) -->
  <div
    v-else
    class="mrx-grid-body"
    :style="{ minWidth: gridContentWidth ? `max(100%, ${gridContentWidth})` : '100%' }"
  >
    <template v-for="i in renderRange" :key="i">
      <template v-if="isGroupRow(getRenderRow(i))">
        <AdeoGridGroupRow
          :header-name="String(getRenderRow(i).__mrxHeaderName)"
          :value="getRenderRow(i).__mrxValue"
          :count="Number(getRenderRow(i).__mrxCount)"
          :depth="Number(getRenderRow(i).__mrxDepth)"
          :expanded="isGroupExpanded(String(getRenderRow(i).__mrxKey))"
          :columns="columns"
          :pinned-left-columns="leftColumns"
          :pinned-right-columns="rightColumns"
          :has-pinned="hasPinned"
          :selectable="selectable"
          :expandable="expandable"
          :show-row-numbers="showRowNumbers"
          :get-column-width="getColumnWidth"
          :get-pinned-style="getPinnedStyle"
          :get-utility-style="getUtilityStyle"
          :left-spacer-width="leftSpacerWidth"
          :right-spacer-width="rightSpacerWidth"
          @toggle="emit('toggleGroup', String(getRenderRow(i).__mrxKey))"
        />
      </template>
      <template v-else>
        <AdeoGridRow
          :row="getRenderRow(i)"
          :row-index="i"
          :columns="columns"
          :pinned-left-columns="leftColumns"
          :pinned-right-columns="rightColumns"
          :has-pinned="hasPinned"
          :selectable="selectable"
          :selected="isRowSelected(getRenderRow(i), i)"
          :expandable="expandable"
          :expanded="isExpanded(i)"
          :active-field="activeFieldForRow(i)"
          :editing-field="editingFieldForRow(i)"
          :edit-value="editingDraft"
          :get-cell-flags="getCellFlags"
          :get-column-width="getColumnWidth"
          :get-pinned-style="getPinnedStyle"
          :get-utility-style="getUtilityStyle"
          :left-spacer-width="leftSpacerWidth"
          :right-spacer-width="rightSpacerWidth"
          :fill-field="fillField"
          :show-row-numbers="showRowNumbers"
          :row-number="i + 1"
          @toggle-select="(e?: MouseEvent) => emit('toggleSelect', i, e)"
          @toggle-expand="emit('toggleExpand', i)"
          @activate-cell="(field: string, e: MouseEvent) => emit('activateCell', i, field, e)"
          @edit-start="(field: string) => emit('editStart', i, field)"
          @edit-input="(v: unknown) => emit('editInput', v)"
          @edit-commit="(d: 'down' | 'right' | 'left' | 'stay') => emit('editCommit', d)"
          @edit-cancel="emit('editCancel')"
          @edit-blur="emit('editBlur')"
          @fill-handle-mousedown="(e: MouseEvent) => emit('fillHandleMousedown', e)"
        >
          <template v-if="$slots.cell" #cell="cellSlot">
            <slot name="cell" v-bind="cellSlot" />
          </template>
        </AdeoGridRow>
        <AdeoGridDetailRow v-if="expandable && isExpanded(i)">
          <slot name="expand-row" :row="getRenderRow(i)" :index="i" />
        </AdeoGridDetailRow>
      </template>
    </template>
  </div>
</template>
