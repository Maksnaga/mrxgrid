/**
 * Built-in cell renderers — Sprint 4 (REFONTE-PLAN-V2 §2.8).
 *
 * Resolved by `AdeoGridCell` when a column declares `renderer: '<name>'`
 * with a string instead of a Component. Keeps the column definition
 * declarative for the common cases ("just render this value as a tag")
 * without forcing the consumer to reach for `defineComponent`.
 *
 * Add a new alias here + extend `BuiltinRendererName` to expose it.
 */

import { defineComponent, h, markRaw } from 'vue'
import type { Component } from 'vue'
import { MTag } from '@mozaic-ds/vue'

const TagRenderer = markRaw(
  defineComponent({
    name: 'AdeoBuiltinTagRenderer',
    props: {
      value: { type: null, required: false, default: null },
    },
    setup(props) {
      return () => {
        if (props.value == null || props.value === '') return null
        return h(MTag, {
          type: 'informative',
          size: 's',
          label: String(props.value),
        })
      }
    },
  }),
)

export type BuiltinRendererName = 'tag'

export const BUILTIN_RENDERERS: Record<BuiltinRendererName, Component> = {
  tag: TagRenderer,
}
