<script setup lang="ts">
/**
 * Panneau "Tutoriel" — guide pas-à-pas pour construire une datagrid pro
 * avec Grid + Mozaic. 19 étapes groupées en 6 phases.
 *
 * Layout split horizontal :
 *   • Sidebar 300px — étapes numérotées, groupées par phase
 *   • Viewer flex 1 — par étape : titre + objectif + explication + snippet
 *     highlighté Shiki + see-also (lien vers fichier complet du demo)
 *
 * Navigation : sidebar (clic), boutons "← Précédent" / "Suivant →" en bas
 * du viewer, raccourci clavier flèches ← / →.
 *
 * Le contenu vit dans `tutorial-catalog.ts`. Les fichiers du demo sont
 * importés au build via `import.meta.glob` (?raw) pour le see-also.
 */

import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { MButton } from '@mozaic-ds/vue'
import { Copy24, Check24, ChevronRight24, ChevronLeft24 } from '@mozaic-ds/icons-vue'
import { highlightCode } from '../composables/useShikiHighlighter'
import { TUTORIAL_STEPS, type TutorialStep } from './tutorial/tutorial-catalog'

// ---------------------------------------------------------------------------
// Glob des sources demo pour le see-also (`globKey` côté catalogue pointe ici)
// ---------------------------------------------------------------------------
// On vit dans `src/app/components/`, donc :
//   `../` = `src/app/`     (DemoPage + composables + mock)
//   `./` = `src/app/components/` (cells, filters, detail, ToolbarActions…)
const RAW_FILES = import.meta.glob<string>(
  [
    '../DemoPage.vue',
    '../composables/*.ts',
    '../mock/api.ts',
    './cells/*.vue',
    './filters/*.vue',
    './detail/*.vue',
    './ToolbarActions.vue',
    './ProductDrawer.vue',
  ],
  { query: '?raw', import: 'default', eager: true },
)

// ---------------------------------------------------------------------------
// Groupement par phase pour la sidebar
// ---------------------------------------------------------------------------
interface PhaseGroup {
  title: string
  steps: TutorialStep[]
}

const PHASES = computed<PhaseGroup[]>(() => {
  const groups = new Map<string, TutorialStep[]>()
  for (const step of TUTORIAL_STEPS) {
    let arr = groups.get(step.phase)
    if (!arr) {
      arr = []
      groups.set(step.phase, arr)
    }
    arr.push(step)
  }
  return Array.from(groups.entries()).map(([title, steps]) => ({ title, steps }))
})

// ---------------------------------------------------------------------------
// État courant
// ---------------------------------------------------------------------------
const currentIndex = ref(0)
const currentStep = computed<TutorialStep>(() => TUTORIAL_STEPS[currentIndex.value]!)
const totalSteps = TUTORIAL_STEPS.length

const highlightedSnippet = ref('')
const isHighlighting = ref(false)
const copied = ref(false)

watch(
  currentStep,
  async (step) => {
    if (!step) return
    isHighlighting.value = true
    try {
      highlightedSnippet.value = await highlightCode(
        step.snippet,
        step.snippetLang === 'vue' ? 'snippet.vue' : 'snippet.ts',
      )
    } finally {
      isHighlighting.value = false
    }
  },
  { immediate: true },
)

// Reset le bouton "Copié !" quand on change d'étape — sinon il reste en
// état "✓ Copié" alors qu'on regarde un autre snippet.
watch(currentStep, () => {
  copied.value = false
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function gotoStep(index: number): void {
  if (index < 0 || index >= totalSteps) return
  currentIndex.value = index
}

function gotoPrev(): void {
  gotoStep(currentIndex.value - 1)
}

function gotoNext(): void {
  gotoStep(currentIndex.value + 1)
}

const canPrev = computed(() => currentIndex.value > 0)
const canNext = computed(() => currentIndex.value < totalSteps - 1)

// Raccourcis clavier ← / → — uniquement quand le focus n'est pas dans un
// input pour ne pas marcher sur les pieds des autres widgets.
function onKeyNav(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
  if (target?.isContentEditable) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    gotoPrev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    gotoNext()
  }
}

onMounted(() => document.addEventListener('keydown', onKeyNav))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeyNav))

// ---------------------------------------------------------------------------
// Copy snippet
// ---------------------------------------------------------------------------
async function onCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(currentStep.value.snippet)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1800)
  } catch {
    // Clipboard API indisponible — on ignore silencieusement.
  }
}

// ---------------------------------------------------------------------------
// See-also : ouvrir le fichier source brut dans un nouveau modal/popup
// ---------------------------------------------------------------------------
// Pour rester simple, on télécharge en blob et open dans une nouvelle tab.
// L'utilisateur voit le fichier ENTIER en texte brut. Pas de syntax
// highlight ici — le but est juste de voir le contexte complet pour les
// devs qui veulent comprendre comment les snippets s'enchaînent.
function openSeeAlso(): void {
  const ref = currentStep.value.seeAlso
  if (!ref) return
  const src = RAW_FILES[ref.globKey]
  if (!src) return
  const blob = new Blob([src], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  // On révoque le blob après quelques secondes pour libérer la mémoire.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
</script>

<template>
  <div class="tutorial">
    <!-- Sidebar — phases + étapes -->
    <nav class="tutorial__sidebar" aria-label="Étapes du tutoriel">
      <header class="tutorial__sidebar-header">
        <p class="tutorial__sidebar-overline">Tutoriel</p>
        <h2 class="tutorial__sidebar-title">Construire une datagrid pro</h2>
        <p class="tutorial__sidebar-progress">
          {{ currentIndex + 1 }} / {{ totalSteps }} étapes
        </p>
      </header>

      <div v-for="phase in PHASES" :key="phase.title" class="tutorial__phase">
        <h3 class="tutorial__phase-title">{{ phase.title }}</h3>
        <ul class="tutorial__step-list">
          <li v-for="step in phase.steps" :key="step.id">
            <button
              type="button"
              class="tutorial__step-btn"
              :class="{ 'tutorial__step-btn--active': step.id === currentStep.id }"
              @click="gotoStep(step.number - 1)"
            >
              <span class="tutorial__step-number">{{ step.number }}</span>
              <span class="tutorial__step-label">{{ step.title }}</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Viewer — contenu de l'étape courante -->
    <section class="tutorial__viewer">
      <article class="tutorial__article">
        <header class="tutorial__step-header">
          <p class="tutorial__overline">
            Étape {{ currentStep.number }} / {{ totalSteps }} · {{ currentStep.phase }}
          </p>
          <h1 class="tutorial__step-title">{{ currentStep.title }}</h1>
          <p class="tutorial__objective">
            <strong>Objectif —</strong>
            <span v-html="currentStep.objective" />
          </p>
        </header>

        <!-- Explication : paragraphes avec HTML inline (code, strong, kbd) -->
        <div class="tutorial__explanation">
          <p
            v-for="(p, i) in currentStep.explanation"
            :key="i"
            v-html="p"
          />
        </div>

        <!-- Snippet — Shiki highlight + bouton copier -->
        <div class="tutorial__snippet">
          <header class="tutorial__snippet-header">
            <span class="tutorial__snippet-label">Code à copier</span>
            <MButton size="s" outlined @click="onCopy">
              <template #leftIcon>
                <Check24 v-if="copied" />
                <Copy24 v-else />
              </template>
              {{ copied ? 'Copié !' : 'Copier' }}
            </MButton>
          </header>

          <p v-if="isHighlighting" class="tutorial__snippet-loading">
            Chargement du highlighter…
          </p>

          <!-- v-html sûr ici : Shiki escape tous les caractères du source. -->
          <div class="tutorial__snippet-code" v-html="highlightedSnippet" />
        </div>

        <!-- See-also vers le fichier complet du demo -->
        <aside v-if="currentStep.seeAlso" class="tutorial__see-also">
          <p class="tutorial__see-also-label">Voir dans le demo</p>
          <button
            type="button"
            class="tutorial__see-also-btn"
            @click="openSeeAlso"
          >
            {{ currentStep.seeAlso.label }}
            <code class="tutorial__see-also-path">{{ currentStep.seeAlso.path }}</code>
          </button>
        </aside>

        <!-- Navigation prev/next -->
        <footer class="tutorial__nav">
          <MButton
            outlined
            :disabled="!canPrev"
            @click="gotoPrev"
          >
            <template #leftIcon>
              <ChevronLeft24 />
            </template>
            Précédent
          </MButton>

          <span class="tutorial__nav-counter">
            {{ currentIndex + 1 }} / {{ totalSteps }}
          </span>

          <MButton
            appearance="accent"
            :disabled="!canNext"
            @click="gotoNext"
          >
            Étape suivante
            <template #rightIcon>
              <ChevronRight24 />
            </template>
          </MButton>
        </footer>
      </article>
    </section>
  </div>
</template>

<style scoped lang="scss">
.tutorial {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-border-primary, #e3e6ea);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

// ----------------------------------------------------------------- Sidebar
.tutorial__sidebar {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border-primary, #e3e6ea);
  background: var(--color-background-secondary, #f6f7f8);
  overflow-y: auto;
  padding-bottom: 24px;
}

.tutorial__sidebar-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--color-border-primary, #e3e6ea);
  background: #fff;
}

.tutorial__sidebar-overline {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-accent, #1a73e8);
}

.tutorial__sidebar-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text-primary, #0f172a);
}

.tutorial__sidebar-progress {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary, #4f5560);
}

.tutorial__phase {
  margin-top: 20px;
}

.tutorial__phase-title {
  padding: 0 20px 6px;
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-tertiary, #6c727c);
}

.tutorial__step-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tutorial__step-btn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text-primary, #0f172a);
  transition: background 120ms;
}

.tutorial__step-btn:hover {
  background: #fff;
}

.tutorial__step-btn--active {
  background: #fff;
  font-weight: 600;
  border-left: 3px solid var(--color-text-accent, #1a73e8);
  padding-left: 17px;
}

.tutorial__step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-background-secondary, #e8ecef);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-secondary, #4f5560);
}

.tutorial__step-btn--active .tutorial__step-number {
  background: var(--color-text-accent, #1a73e8);
  color: #fff;
}

.tutorial__step-label {
  flex: 1;
}

// ------------------------------------------------------------------ Viewer
.tutorial__viewer {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.tutorial__article {
  max-width: 880px;
  margin: 0 auto;
  padding: 36px 40px 48px;
}

.tutorial__step-header {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border-primary, #e3e6ea);
  margin-bottom: 24px;
}

.tutorial__overline {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-accent, #1a73e8);
}

.tutorial__step-title {
  margin: 0 0 14px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-text-primary, #0f172a);
}

.tutorial__objective {
  margin: 0;
  padding: 12px 16px;
  background: #f0f9ff;
  border-left: 3px solid #0ea5e9;
  border-radius: 0 6px 6px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-primary, #0f172a);
}

.tutorial__objective :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  background: rgba(14, 165, 233, 0.12);
  padding: 1px 6px;
  border-radius: 3px;
}

.tutorial__explanation {
  margin: 0 0 24px;
}

.tutorial__explanation p {
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 1.65;
  color: var(--color-text-primary, #0f172a);
}

.tutorial__explanation :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  background: var(--color-background-secondary, #f6f7f8);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--color-text-accent, #1a73e8);
}

.tutorial__explanation :deep(strong) {
  font-weight: 600;
}

.tutorial__explanation :deep(em) {
  font-style: italic;
  color: var(--color-text-secondary, #4f5560);
}

.tutorial__explanation :deep(kbd) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: #fff;
  border: 1px solid var(--color-border-primary, #d1d5db);
  border-radius: 3px;
  padding: 1px 5px;
  box-shadow: 0 1px 0 var(--color-border-primary, #d1d5db);
}

// ---------------------------------------------------------------- Snippet
.tutorial__snippet {
  margin: 24px 0;
}

.tutorial__snippet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.tutorial__snippet-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-tertiary, #6c727c);
}

.tutorial__snippet-loading {
  padding: 12px 16px;
  background: var(--color-background-secondary, #f6f7f8);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #4f5560);
}

.tutorial__snippet-code {
  font-size: 13px;
  line-height: 1.55;

  :deep(pre.shiki) {
    margin: 0;
    padding: 18px 22px;
    border-radius: 8px;
    background: #f8fafc !important;
    overflow-x: auto;
    border: 1px solid var(--color-border-primary, #e3e6ea);
  }

  :deep(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: inherit;
  }

  :deep(pre.shiki-fallback) {
    margin: 0;
    padding: 18px 22px;
    background: #f8fafc;
    border-radius: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: inherit;
    white-space: pre;
    overflow-x: auto;
    border: 1px solid var(--color-border-primary, #e3e6ea);
  }
}

// ---------------------------------------------------------------- See-also
.tutorial__see-also {
  margin: 28px 0 0;
  padding: 16px 20px;
  background: #fafbfc;
  border: 1px dashed var(--color-border-primary, #d1d5db);
  border-radius: 8px;
}

.tutorial__see-also-label {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-tertiary, #6c727c);
}

.tutorial__see-also-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 8px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-accent, #1a73e8);
}

.tutorial__see-also-btn:hover {
  text-decoration: underline;
}

.tutorial__see-also-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-secondary, #4f5560);
}

// -------------------------------------------------------------- Navigation
.tutorial__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border-primary, #e3e6ea);
}

.tutorial__nav-counter {
  font-size: 13px;
  color: var(--color-text-tertiary, #6c727c);
}
</style>
