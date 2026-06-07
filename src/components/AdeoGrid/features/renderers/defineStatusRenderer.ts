/**
 * Status badge renderer helper — Sprint 4 (REFONTE-PLAN-V2 §2.8).
 *
 * Returns a Vue component that, given a `value`, looks up `(label,
 * appearance)` in the supplied map and renders a Mozaic `<MTag>` styled
 * for that appearance.
 *
 * Pattern matches Excel "Conditional Formatting" but via a typed component
 * ref — safer than rendering arbitrary HTML strings inside cells.
 *
 * Example:
 *
 *   const StatusRenderer = defineStatusRenderer({
 *     'in-stock':    { label: 'En stock',    appearance: 'success' },
 *     'out-of-stock':{ label: 'Rupture',     appearance: 'danger'  },
 *     'limited':     { label: 'Limité',      appearance: 'neutral' },
 *     'on-order':    { label: 'En commande', appearance: 'warning' },
 *   })
 *
 *   const columns = [
 *     { field: 'status', headerName: 'Statut', renderer: StatusRenderer },
 *   ]
 *
 * The returned component is already wrapped in `markRaw` so it can be
 * stored on a column definition without Vue trying to make it reactive.
 */

import { defineComponent, h, markRaw } from 'vue'
import type { Component } from 'vue'
import { MTag } from '@mozaic-ds/vue'

export type StatusAppearance = 'success' | 'danger' | 'warning' | 'neutral'

export interface StatusMeta {
  label: string
  appearance: StatusAppearance
}

const STATUS_STYLES: Record<StatusAppearance, { background: string; color: string }> = {
  success: { background: '#e6f4ea', color: '#137333' },
  danger: { background: '#fce8e6', color: '#c5221f' },
  warning: { background: '#fef7e0', color: '#b06000' },
  neutral: { background: '#f1f3f4', color: '#5f6368' },
}

export function defineStatusRenderer<T extends string>(
  map: Record<T, StatusMeta>,
): Component {
  return markRaw(
    defineComponent({
      name: 'MrxStatusRenderer',
      props: {
        value: { type: null, required: false, default: null },
      },
      setup(props) {
        return () => {
          if (props.value == null) return null
          const key = String(props.value) as T
          const meta = map[key]
          if (!meta) return null
          const palette = STATUS_STYLES[meta.appearance]
          return h(MTag, {
            type: 'informative',
            size: 's',
            label: meta.label,
            style: {
              background: palette.background,
              color: palette.color,
              fontWeight: 600,
            },
          })
        }
      },
    }),
  )
}
