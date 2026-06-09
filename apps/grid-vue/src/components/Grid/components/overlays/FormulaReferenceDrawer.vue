<script setup lang="ts">
/**
 * Formula function reference drawer — categorised list of available formula
 * functions with signature + example. Stub version uses a hard-coded list
 * mirroring the Angular `DEFAULT_FORMULA_FUNCTIONS` registry. When the
 * formula engine is ported (§12.3), feed `functions` from
 * `useFormulaEngine.functions` so the list stays in sync.
 *
 * Sprint 7 — wraps itself in `MDrawer`. Consumers control visibility via
 * `:open` and don't need an `<aside>` chrome. The `close` event is kept
 * for API compatibility but is now driven by `MDrawer`'s overlay/close button.
 */

import { MDrawer } from '@mozaic-ds/vue'

defineOptions({ name: 'AdGridFormulaReferenceDrawer' })

interface FunctionDoc {
  name: string
  category: string
  signature: string
  description: string
  example?: string
}

const FUNCTIONS: FunctionDoc[] = [
  // Maths
  {
    name: 'SUM',
    category: 'Maths',
    signature: 'SUM(value1, value2, …)',
    description: 'Adds the supplied numbers.',
    example: 'SUM(A1:A10)',
  },
  {
    name: 'AVERAGE',
    category: 'Maths',
    signature: 'AVERAGE(value1, value2, …)',
    description: 'Returns the arithmetic mean.',
    example: 'AVERAGE(A1:A10)',
  },
  {
    name: 'MIN',
    category: 'Maths',
    signature: 'MIN(value1, value2, …)',
    description: 'Returns the smallest value.',
    example: 'MIN(A1:A10)',
  },
  {
    name: 'MAX',
    category: 'Maths',
    signature: 'MAX(value1, value2, …)',
    description: 'Returns the largest value.',
    example: 'MAX(A1:A10)',
  },
  {
    name: 'COUNT',
    category: 'Maths',
    signature: 'COUNT(value1, value2, …)',
    description: 'Counts the numeric values.',
    example: 'COUNT(A1:A10)',
  },
  {
    name: 'ROUND',
    category: 'Maths',
    signature: 'ROUND(value, digits)',
    description: 'Rounds a number to a given number of digits.',
    example: 'ROUND(3.1415, 2)',
  },
  {
    name: 'ABS',
    category: 'Maths',
    signature: 'ABS(value)',
    description: 'Absolute value.',
    example: 'ABS(-5)',
  },
  {
    name: 'POWER',
    category: 'Maths',
    signature: 'POWER(base, exponent)',
    description: 'Raises a number to a power.',
    example: 'POWER(2, 10)',
  },

  // Logic
  {
    name: 'IF',
    category: 'Logic',
    signature: 'IF(condition, ifTrue, ifFalse)',
    description: 'Returns one value if the condition is true, otherwise another.',
    example: 'IF(A1 > 0, "positive", "non-positive")',
  },
  {
    name: 'AND',
    category: 'Logic',
    signature: 'AND(value1, value2, …)',
    description: 'Returns true if all arguments are truthy.',
    example: 'AND(A1 > 0, B1 < 10)',
  },
  {
    name: 'OR',
    category: 'Logic',
    signature: 'OR(value1, value2, …)',
    description: 'Returns true if any argument is truthy.',
    example: 'OR(A1 = "yes", A1 = "y")',
  },
  {
    name: 'NOT',
    category: 'Logic',
    signature: 'NOT(value)',
    description: 'Inverts the boolean value.',
    example: 'NOT(A1)',
  },

  // Text
  {
    name: 'CONCAT',
    category: 'Text',
    signature: 'CONCAT(value1, value2, …)',
    description: 'Concatenates the supplied strings.',
    example: 'CONCAT(A1, " ", B1)',
  },
  {
    name: 'UPPER',
    category: 'Text',
    signature: 'UPPER(text)',
    description: 'Returns the text in upper case.',
    example: 'UPPER("hello")',
  },
  {
    name: 'LOWER',
    category: 'Text',
    signature: 'LOWER(text)',
    description: 'Returns the text in lower case.',
    example: 'LOWER("HELLO")',
  },
  {
    name: 'LEN',
    category: 'Text',
    signature: 'LEN(text)',
    description: 'Returns the length of the text.',
    example: 'LEN("hello")',
  },
  {
    name: 'TRIM',
    category: 'Text',
    signature: 'TRIM(text)',
    description: 'Removes leading / trailing whitespace.',
    example: 'TRIM("  hi  ")',
  },

  // Lookup
  {
    name: 'VLOOKUP',
    category: 'Lookup',
    signature: 'VLOOKUP(key, range, columnIndex)',
    description: 'Vertical lookup of a key in the first column of a range.',
    example: 'VLOOKUP(A2, B:D, 3)',
  },
]

const grouped = FUNCTIONS.reduce<Record<string, FunctionDoc[]>>((acc, fn) => {
  if (!acc[fn.category]) acc[fn.category] = []
  acc[fn.category]!.push(fn)
  return acc
}, {})

const categories = Object.keys(grouped)

defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
  /**
   * Emitted when the user clicks a function name. The `text` payload is
   * the function name with an open paren appended (e.g. `"SUM("`) — wire
   * this to `AdGridFormulaBar.insertText(text)` so the function lands at the
   * caret with the cursor ready to type arguments.
   */
  insert: [text: string]
}>()

function onInsert(name: string): void {
  emit('insert', `${name}(`)
}

function close() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <!-- See AdGridFilterDrawer.vue for why we Teleport to <body>. -->
  <Teleport to="body">
  <!-- See AdGridGroupingDrawer.vue for why `close-on-overlay` stays
       disabled (Mozaic's MDrawer fires it on dialog-body whitespace). -->
  <MDrawer
    :open="open"
    title="Formula reference"
    position="right"
    :close-on-overlay="false"
    @update:open="(v) => (v ? null : close())"
  >
    <div class="formula-reference__body">
      <section v-for="cat in categories" :key="cat" class="formula-reference__category">
        <h4 class="formula-reference__category-title">{{ cat }}</h4>
        <ul class="formula-reference__list">
          <li v-for="fn in grouped[cat]" :key="fn.name" class="formula-reference__item">
            <button
              type="button"
              class="formula-reference__name"
              :title="`Insert ${fn.name}(`"
              @click="onInsert(fn.name)"
            >
              {{ fn.name }}
            </button>
            <code class="formula-reference__signature">{{ fn.signature }}</code>
            <p class="formula-reference__description">{{ fn.description }}</p>
            <code v-if="fn.example" class="formula-reference__example">{{ fn.example }}</code>
          </li>
        </ul>
      </section>
    </div>
  </MDrawer>
  </Teleport>
</template>

<style scoped lang="scss">
.formula-reference {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__header {
    padding: 12px;
    border-bottom: 1px solid var(--color-border-primary, #ddd);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-200, 14px);
    font-weight: var(--font-weight-semi-bold, 600);
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  &__category {
    margin-bottom: 16px;
  }

  &__category-title {
    margin: 0 0 8px;
    font-size: var(--font-size-50, 12px);
    font-weight: var(--font-weight-semi-bold, 600);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary, #666);
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__item {
    border: 1px solid var(--color-border-primary, #eee);
    border-radius: var(--border-radius-s, 4px);
    padding: 8px 10px;
    background: var(--color-background-primary, #fff);
  }

  &__name {
    display: inline-block;
    padding: 0;
    border: none;
    background: transparent;
    font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, monospace);
    font-size: var(--font-size-100, 13px);
    font-weight: var(--font-weight-semi-bold, 600);
    color: var(--color-background-accent-inverse, #1a73e8);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  &__signature {
    display: block;
    margin-top: 2px;
    font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, monospace);
    font-size: var(--font-size-25, 11px);
    color: var(--color-text-secondary, #666);
  }

  &__description {
    margin: 4px 0 0;
    font-size: var(--font-size-50, 12px);
    color: var(--color-text-primary, #222);
  }

  &__example {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 6px;
    border-radius: var(--border-radius-xs, 2px);
    background: var(--color-background-secondary, #f5f5f5);
    font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, monospace);
    font-size: var(--font-size-25, 11px);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    padding: 8px 12px;
    border-top: 1px solid var(--color-border-primary, #ddd);
  }
}
</style>
