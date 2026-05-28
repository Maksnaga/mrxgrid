<script setup lang="ts">
/**
 * Drawer création / édition d'un produit.
 *
 * `mode = 'create'` → vide, submit appelle `createProduct(payload)`.
 * `mode = 'edit'`   → pré-rempli depuis `product`, submit appelle
 *                     `updateProduct(id, patch)`.
 *
 * Le composant est contrôlé via `v-model:open` et `:product`. Il émet :
 *  - `created(product)` après une création réussie
 *  - `updated(product)` après une édition réussie
 *  - `delete(id)` quand l'utilisateur veut supprimer (le parent ouvre la
 *    modal de confirmation — séparation de responsabilité)
 *
 * La validation est inline : un `MField` par champ avec son `:error` lié
 * à un computed. Pas de lib externe (vee-validate / zod) — pour la démo,
 * 4 règles simples maison.
 */

import { computed, ref, watch } from 'vue'
import {
  MButton,
  MDrawer,
  MField,
  MIconButton,
  MSelect,
  MTextInput,
  MToggle,
} from '@mozaic-ds/vue'
import { Trash24 } from '@mozaic-ds/icons-vue'
import { createProduct, updateProduct } from '../mock/api'
import type { LMProduct } from '../mock/seed'

const props = defineProps<{
  open: boolean
  /** Si présent → édition. Sinon → création. */
  product: LMProduct | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [product: LMProduct]
  updated: [product: LMProduct]
  delete: [id: number]
}>()

const mode = computed(() => (props.product ? 'edit' : 'create'))
const title = computed(() => (mode.value === 'edit' ? 'Éditer le produit' : 'Nouveau produit'))

// État local du form — réinitialisé à chaque ouverture du drawer pour
// garantir qu'un précédent draft ne fuite pas dans la nouvelle session.
interface FormState {
  name: string
  category: LMProduct['category']
  brand: string
  price: number | null
  stock: number | null
  status: LMProduct['status']
  rating: number | null
  energyClass: LMProduct['energyClass']
  promo: boolean
  store: string
}

const CATEGORIES: LMProduct['category'][] = [
  'Plomberie',
  'Électricité',
  'Outillage',
  'Peinture',
  'Jardin',
  'Salle de bain',
  'Cuisine',
  'Quincaillerie',
  'Sols',
  'Chauffage',
]
const STATUSES: { value: LMProduct['status']; label: string }[] = [
  { value: 'in-stock', label: 'En stock' },
  { value: 'low', label: 'Stock faible' },
  { value: 'out', label: 'Rupture' },
  { value: 'preorder', label: 'Précommande' },
]
const ENERGY_CLASSES: LMProduct['energyClass'][] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const STORES = [
  'Lille Englos',
  'Paris Belleville',
  'Lyon Bron',
  'Marseille Plan-de-Campagne',
  'Bordeaux Pessac',
  'Strasbourg Mundolsheim',
]

function emptyForm(): FormState {
  return {
    name: '',
    category: 'Outillage',
    brand: '',
    price: null,
    stock: null,
    status: 'in-stock',
    rating: 4,
    energyClass: 'A',
    promo: false,
    store: STORES[0]!,
  }
}

const form = ref<FormState>(emptyForm())
const submitting = ref(false)
const submitError = ref<string | null>(null)

// (Re)initialise le form chaque fois que le drawer s'ouvre. Le watch sur
// `props.product` couvre le swap "création → édition" sans démonter le
// composant.
watch(
  () => [props.open, props.product] as const,
  ([open, p]) => {
    if (!open) return
    submitError.value = null
    form.value = p
      ? {
          name: p.name,
          category: p.category,
          brand: p.brand,
          price: p.price,
          stock: p.stock,
          status: p.status,
          rating: p.rating,
          energyClass: p.energyClass,
          promo: p.promo,
          store: p.store,
        }
      : emptyForm()
  },
  { immediate: true },
)

// ---------------------------------------------------------------------------
// Validation — règles compactes, l'erreur s'affiche sous le champ touché.
// ---------------------------------------------------------------------------

const errors = computed(() => {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (form.value.name.trim().length < 3) e.name = 'Minimum 3 caractères'
  if (form.value.brand.trim().length < 2) e.brand = 'Minimum 2 caractères'
  if (form.value.price == null || form.value.price < 0) e.price = 'Prix positif requis'
  if (form.value.stock == null || form.value.stock < 0) e.stock = 'Stock positif ou nul'
  return e
})

const isValid = computed(() => Object.keys(errors.value).length === 0)

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

async function onSubmit(): Promise<void> {
  if (!isValid.value) return
  submitting.value = true
  submitError.value = null
  try {
    const payload = {
      name: form.value.name.trim(),
      category: form.value.category,
      brand: form.value.brand.trim(),
      price: form.value.price ?? 0,
      stock: form.value.stock ?? 0,
      status: form.value.status,
      rating: form.value.rating ?? 0,
      energyClass: form.value.energyClass,
      promo: form.value.promo,
      store: form.value.store,
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    if (props.product) {
      const updated = await updateProduct(props.product.id, payload)
      emit('updated', updated)
    } else {
      const created = await createProduct(payload)
      emit('created', created)
    }
    emit('update:open', false)
  } catch (err) {
    submitError.value = (err as Error).message
  } finally {
    submitting.value = false
  }
}

function onClose(): void {
  emit('update:open', false)
}

function onDelete(): void {
  if (props.product) emit('delete', props.product.id)
}
</script>

<template>
  <MDrawer :open="open" :title="title" position="right" extended @close="onClose">
    <form class="product-drawer__form" @submit.prevent="onSubmit">
      <MField
        id="prod-name"
        label="Nom du produit"
        requirement-text="(requis)"
        :is-invalid="!!errors.name"
        message-id="prod-name-msg"
        :message="errors.name"
      >
        <MTextInput
          id="prod-name"
          v-model="form.name"
          size="s"
          placeholder="Ex. Mètre ruban 5m"
        />
      </MField>

      <div class="product-drawer__row">
        <MField id="prod-category" label="Rayon" requirement-text="(requis)">
          <MSelect
            id="prod-category"
            v-model="form.category"
            size="s"
            :options="CATEGORIES.map((c) => ({ text: c, value: c }))"
          />
        </MField>
        <MField
          id="prod-brand"
          label="Marque"
          requirement-text="(requis)"
          :is-invalid="!!errors.brand"
          message-id="prod-brand-msg"
          :message="errors.brand"
        >
          <MTextInput id="prod-brand" v-model="form.brand" size="s" placeholder="Ex. Stanley" />
        </MField>
      </div>

      <div class="product-drawer__row">
        <MField
          id="prod-price"
          label="Prix (€)"
          requirement-text="(requis)"
          :is-invalid="!!errors.price"
          message-id="prod-price-msg"
          :message="errors.price"
        >
          <MTextInput
            id="prod-price"
            :model-value="form.price ?? ''"
            type="number"
            size="s"
            @update:model-value="(v: string | number) => (form.price = v === '' ? null : Number(v))"
          />
        </MField>
        <MField
          id="prod-stock"
          label="Stock"
          requirement-text="(requis)"
          :is-invalid="!!errors.stock"
          message-id="prod-stock-msg"
          :message="errors.stock"
        >
          <MTextInput
            id="prod-stock"
            :model-value="form.stock ?? ''"
            type="number"
            size="s"
            @update:model-value="(v: string | number) => (form.stock = v === '' ? null : Number(v))"
          />
        </MField>
      </div>

      <div class="product-drawer__row">
        <MField id="prod-status" label="État">
          <MSelect
            id="prod-status"
            v-model="form.status"
            size="s"
            :options="STATUSES.map((s) => ({ text: s.label, value: s.value }))"
          />
        </MField>
        <MField id="prod-energy" label="Classe énergie">
          <MSelect
            id="prod-energy"
            v-model="form.energyClass"
            size="s"
            :options="ENERGY_CLASSES.map((c) => ({ text: c, value: c }))"
          />
        </MField>
      </div>

      <MField id="prod-store" label="Magasin">
        <MSelect
          id="prod-store"
          v-model="form.store"
          size="s"
          :options="STORES.map((s) => ({ text: s, value: s }))"
        />
      </MField>

      <MField id="prod-promo" label="En promotion">
        <MToggle id="prod-promo" v-model="form.promo" />
      </MField>

      <p v-if="submitError" class="product-drawer__error">
        {{ submitError }}
      </p>
    </form>

    <template #footer>
      <div class="product-drawer__footer">
        <MIconButton
          v-if="mode === 'edit'"
          ghost
          appearance="danger"
          aria-label="Supprimer"
          title="Supprimer"
          @click="onDelete"
        >
          <template #icon><Trash24 /></template>
        </MIconButton>

        <MButton outlined @click="onClose">Annuler</MButton>
        <MButton
          appearance="accent"
          :disabled="!isValid || submitting"
          :is-loading="submitting"
          @click="onSubmit"
        >
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </MButton>
      </div>
    </template>
  </MDrawer>
</template>

<style scoped lang="scss">
.product-drawer__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.product-drawer__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.product-drawer__error {
  color: #dc2626;
  font-size: 13px;
  margin: 0;
}

.product-drawer__footer {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  width: 100%;
}

.product-drawer__footer > :first-child {
  margin-right: auto;
}
</style>
