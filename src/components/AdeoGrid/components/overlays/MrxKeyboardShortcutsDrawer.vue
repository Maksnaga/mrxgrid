<script setup lang="ts">
/**
 * Keyboard shortcuts cheat-sheet — read-only doc drawer.
 *
 * Static content for now (matches the FR-localised list from Angular
 * `GridKeyboardShortcutsDrawerComponent`). When `useKeyboardEngine` exposes
 * its registered shortcuts as data, fetch the list from there to stay in sync.
 *
 * Sprint 7 — wraps itself in `MDrawer` so consumers control visibility via
 * `:open` and don't need to provide their own `<aside>` chrome. The `close`
 * event is kept for API stability but is now driven by `MDrawer`'s overlay
 * click + close button.
 */

import { MDrawer } from '@mozaic-ds/vue'

interface ShortcutItem {
  keys: string
  label: string
  parts: string[]
}

interface ShortcutGroup {
  title: string
  items: ShortcutItem[]
}

const SHORTCUTS: Array<{ title: string; items: Array<{ keys: string; label: string }> }> = [
  {
    title: 'Navigation',
    items: [
      { keys: '← ↑ → ↓', label: 'Déplacer la cellule active' },
      { keys: 'Ctrl + Flèche', label: 'Sauter au bord du bloc de données' },
      { keys: 'Home / End', label: 'Début / fin de la ligne' },
      { keys: 'Ctrl + Home / End', label: 'Première / dernière cellule' },
      { keys: 'PageUp / PageDown', label: 'Page précédente / suivante' },
      { keys: 'Tab / Shift+Tab', label: 'Cellule suivante / précédente' },
      { keys: 'Enter / Shift+Enter', label: 'Descendre / remonter' },
    ],
  },
  {
    title: 'Sélection',
    items: [
      { keys: 'Shift + Flèche', label: 'Étendre la plage' },
      { keys: 'Shift + Ctrl + Flèche', label: "Étendre jusqu'au bord du bloc" },
      { keys: 'Shift + Home / End', label: 'Étendre au début / fin de la ligne' },
      { keys: 'Shift + Ctrl + Home / End', label: 'Étendre au début / fin du tableau' },
      { keys: 'Shift + PageUp / Down', label: "Étendre d'une page" },
      { keys: 'Ctrl + A', label: 'Sélectionner tout' },
      { keys: 'Shift + Espace', label: 'Sélectionner la ligne' },
      { keys: 'Ctrl + Espace', label: 'Sélectionner la colonne' },
    ],
  },
  {
    title: 'Édition',
    items: [
      { keys: 'Enter / F2', label: 'Entrer en édition' },
      { keys: 'Touche imprimable', label: 'Typing-to-edit (remplace la valeur)' },
      { keys: 'Escape', label: "Annuler l'édition" },
      { keys: 'Enter', label: 'Valider + descendre' },
      { keys: 'Tab / Shift+Tab', label: 'Valider + droite / gauche' },
      { keys: 'Alt + Enter', label: 'Retour à la ligne (texte)' },
      { keys: 'Ctrl + Enter', label: 'Valider + remplir la sélection' },
      { keys: 'Backspace / Delete', label: 'Effacer les cellules sélectionnées' },
    ],
  },
  {
    title: 'Presse-papier',
    items: [
      { keys: 'Ctrl + C', label: 'Copier (TSV)' },
      { keys: 'Ctrl + X', label: 'Couper (marching ants)' },
      { keys: 'Ctrl + V', label: 'Coller (déplace après Ctrl+X)' },
      { keys: 'Ctrl + D', label: 'Remplir vers le bas (fill down)' },
      { keys: 'Ctrl + R', label: 'Remplir vers la droite (fill right)' },
    ],
  },
  {
    title: 'Historique',
    items: [
      { keys: 'Ctrl + Z', label: 'Annuler (undo)' },
      { keys: 'Ctrl + Y', label: 'Rétablir (redo)' },
      { keys: 'Ctrl + Shift + Z', label: 'Rétablir (redo, alt.)' },
    ],
  },
]

const groups: ShortcutGroup[] = SHORTCUTS.map((group) => ({
  title: group.title,
  items: group.items.map((item) => ({
    keys: item.keys,
    label: item.label,
    parts: item.keys.split(' '),
  })),
}))

defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

function close() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <!-- See MrxGridFilterDrawer.vue for why we Teleport to <body>. -->
  <Teleport to="body">
  <!-- See MrxGroupingDrawer.vue for why `close-on-overlay` stays
       disabled (Mozaic's MDrawer fires it on dialog-body whitespace). -->
  <MDrawer
    :open="open"
    title="Keyboard shortcuts"
    position="right"
    :close-on-overlay="false"
    @update:open="(v) => (v ? null : close())"
  >
    <div class="shortcuts">
      <section v-for="group in groups" :key="group.title" class="shortcuts__group">
        <h4 class="shortcuts__group-title">{{ group.title }}</h4>
        <dl class="shortcuts__list">
          <div v-for="item in group.items" :key="item.keys" class="shortcuts__item">
            <dt class="shortcuts__keys">
              <template v-for="(part, idx) in item.parts" :key="idx">
                <span v-if="part === '+' || part === '/'" class="shortcuts__separator">{{
                  part
                }}</span>
                <kbd v-else class="shortcuts__key">{{ part }}</kbd>
              </template>
            </dt>
            <dd class="shortcuts__label">{{ item.label }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </MDrawer>
  </Teleport>
</template>

<style scoped lang="scss">
.shortcuts {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__group-title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary, #222);
  }

  &__list {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__keys {
    flex: 0 0 auto;
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 220px;
  }

  &__key {
    display: inline-block;
    padding: 2px 6px;
    border: 1px solid var(--color-border-primary, #ddd);
    border-radius: 3px;
    background: var(--color-background-secondary, #f5f5f5);
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    color: var(--color-text-primary, #222);
  }

  &__separator {
    color: var(--color-text-secondary, #999);
    font-size: 11px;
  }

  &__label {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-primary, #222);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
}
</style>
