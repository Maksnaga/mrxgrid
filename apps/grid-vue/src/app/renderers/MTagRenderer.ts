/**
 * `MTagRenderer` — **demo-side** generic renderer that wraps the raw cell
 * value in a Mozaic `<MTag>` (informative type, size 's').
 *
 * Replaces the old library-side `renderer: 'tag'` builtin alias. Lives
 * under `src/app/renderers/` because it's consumer-side sugar — not part
 * of the Grid public API. Library consumers who want a similar tag
 * column should copy this file (or write a richer variant).
 */

import { defineComponent, h, markRaw } from 'vue'
import type { Component } from 'vue'
import { MTag } from '@mozaic-ds/vue'

export const MTagRenderer: Component = markRaw(
  defineComponent({
    name: 'AdeoMTagRenderer',
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
