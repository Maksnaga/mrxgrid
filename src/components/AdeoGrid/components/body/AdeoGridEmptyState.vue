<script setup lang="ts">
/**
 * Default empty-state card rendered when `props.rows.length === 0` and
 * neither loading nor error are active.
 *
 * Two visual variants driven by `hasFilters`:
 *   - `filtered` : the dataset isn't truly empty, the user just filtered
 *     everything out — primary action is "Clear filters", icon a magnifier
 *     with no result.
 *   - `pristine` : no data at all — neutral message with Mozaic Database
 *     glyph, leaving the action zone open for the consumer to wire up
 *     "Add row" / "Import" / etc. via the `#actions` slot.
 *
 * Composers can either replace the whole thing via `<MrxGrid #empty>` or
 * keep the default layout and just inject custom actions through
 * `<MrxGrid #empty-actions>`. The component animates in subtly so it
 * feels intentional rather than abrupt when filters change.
 */
import { computed } from 'vue'
import { Database48, Filter48 } from '@mozaic-ds/icons-vue'
import { MButton } from '@mozaic-ds/vue'

const props = defineProps<{
  /** True when at least one column filter is active — drives variant. */
  hasFilters: boolean
  /** Optional custom title (overrides the default per-variant heading). */
  title?: string
  /** Optional custom description (overrides the default per-variant body). */
  description?: string
}>()

const emit = defineEmits<{
  clearFilters: []
}>()

const variant = computed<'filtered' | 'pristine'>(() =>
  props.hasFilters ? 'filtered' : 'pristine',
)

const headline = computed(() => {
  if (props.title) return props.title
  return variant.value === 'filtered'
    ? 'Aucun résultat ne correspond à votre recherche'
    : 'Aucune donnée à afficher'
})

const subtitle = computed(() => {
  if (props.description) return props.description
  return variant.value === 'filtered'
    ? 'Essayez d’ajuster ou de retirer un filtre pour élargir la sélection.'
    : 'Quand des lignes seront ajoutées, elles s’afficheront ici.'
})
</script>

<template>
  <div class="mrx-empty" role="status" :data-variant="variant">
    <div class="mrx-empty__card">
      <div class="mrx-empty__halo" aria-hidden="true">
        <Filter48 v-if="variant === 'filtered'" class="mrx-empty__icon" />
        <Database48 v-else class="mrx-empty__icon" />
      </div>

      <h3 class="mrx-empty__title">{{ headline }}</h3>
      <p class="mrx-empty__subtitle">{{ subtitle }}</p>

      <div class="mrx-empty__actions">
        <!-- Built-in action when filters are active -->
        <MButton v-if="variant === 'filtered'" theme="primary" size="m" @click="emit('clearFilters')">
          Effacer les filtres
        </MButton>

        <!-- Consumer-defined actions (Add row, Import…) — sit alongside the
             built-in clear-filters button when both apply. -->
        <slot name="actions" :variant="variant" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mrx-empty {
  // Center the card inside its parent (the grid wrapper area). `flex-1`
  // ensures the card takes the remaining vertical space when the grid
  // wrapper is constrained — same reason `.mrx-grid-wrapper` itself uses
  // `flex: 1` in the root.
  flex: 1;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  animation: mrx-empty-in 240ms ease-out;
}

.mrx-empty__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 460px;
  padding: 32px 28px 28px;
}

.mrx-empty__halo {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  background:
    radial-gradient(circle at 30% 30%,
      var(--color-background-accent, #dbeafe),
      var(--color-background-secondary, #f3f4f6));

  // Soft outer glow that picks up the theme accent without being loud.
  &::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    background: var(--color-text-accent, #0071ce);
    opacity: 0.08;
    z-index: -1;
    filter: blur(6px);
  }
}

.mrx-empty[data-variant='filtered'] .mrx-empty__halo {
  background:
    radial-gradient(circle at 30% 30%,
      #fef3c7,
      var(--color-background-secondary, #f3f4f6));

  &::after {
    background: #d97706;
    opacity: 0.12;
  }
}

.mrx-empty__icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-accent, #0071ce);
}

.mrx-empty[data-variant='filtered'] .mrx-empty__icon {
  color: #b45309;
}

.mrx-empty__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text-primary, #0f172a);
}

.mrx-empty__subtitle {
  margin: 0 0 24px;
  max-width: 380px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--color-text-secondary, #475569);
}

.mrx-empty__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.mrx-empty__actions:empty {
  display: none;
}

@keyframes mrx-empty-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mrx-empty {
    animation: none;
  }
}
</style>
