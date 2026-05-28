<script setup lang="ts">
/**
 * Contenu du slot `#expand-row` du grid principal.
 *
 * Affiche une vue détail riche pour la ligne expandée :
 *   - meta du produit en haut (rating, energy, store, magasin)
 *   - mini-grid embarqué des mouvements de stock
 *
 * Montre le pattern "drill-down" — clic sur le chevron → contexte
 * additionnel sans changer de page.
 */

import { MButton } from '@mozaic-ds/vue'
import type { LMProduct } from '../../mock/seed'
import ProductMovementsGrid from './ProductMovementsGrid.vue'

defineProps<{ product: LMProduct }>()
const emit = defineEmits<{ edit: [] }>()
</script>

<template>
  <div class="product-detail-expand">
    <header class="product-detail-expand__meta">
      <div>
        <span class="product-detail-expand__label">Note</span>
        <strong>★ {{ product.rating.toFixed(1) }} / 5</strong>
      </div>
      <div>
        <span class="product-detail-expand__label">Classe énergie</span>
        <strong>{{ product.energyClass }}</strong>
      </div>
      <div>
        <span class="product-detail-expand__label">Magasin</span>
        <strong>{{ product.store }}</strong>
      </div>
      <div>
        <span class="product-detail-expand__label">Promotion</span>
        <strong>{{ product.promo ? 'Oui' : 'Non' }}</strong>
      </div>
      <div>
        <span class="product-detail-expand__label">Dernière maj</span>
        <strong>{{ product.updatedAt }}</strong>
      </div>

      <MButton class="product-detail-expand__edit" outlined size="s" @click="emit('edit')">
        Éditer ce produit
      </MButton>
    </header>

    <section class="product-detail-expand__movements">
      <h3 class="product-detail-expand__title">Mouvements de stock récents</h3>
      <ProductMovementsGrid :product-id="product.id" />
    </section>
  </div>
</template>

<style scoped lang="scss">
.product-detail-expand {
  padding: 16px 24px;
  background: var(--color-background-secondary, #f8fafc);
}

.product-detail-expand__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 24px 40px;
  padding: 12px 0 16px;
  border-bottom: 1px solid var(--color-border-primary, #e2e8f0);
  margin-bottom: 16px;
}

.product-detail-expand__meta > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-detail-expand__label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--color-text-secondary, #64748b);
  letter-spacing: 0.05em;
}

.product-detail-expand__title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #64748b);
}

.product-detail-expand__edit {
  margin-left: auto;
}
</style>
