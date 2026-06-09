/**
 * `useShikiHighlighter` — lazy-loaded singleton autour de Shiki.
 *
 * Pourquoi pas un `npm install shiki` ? L'install npm timeoutait dans
 * l'environnement de la demo (job ~40s, shiki + ses grammars dépassent).
 * On charge donc Shiki en runtime via le CDN ESM `esm.sh` — c'est exactement
 * la même API publique, juste résolu par le navigateur côté dev mode Vite.
 *
 * Le `@vite-ignore` (en commentaire inline juste avant l'argument du
 * `import()`) empêche Vite de tenter une résolution au build : il laisse
 * passer l'URL telle quelle, le navigateur fait le boulot.
 *
 * Le highlighter est créé UNE SEULE FOIS au premier appel (singleton via
 * promesse partagée) ; les appels suivants réutilisent la même instance.
 * Les langs / themes sont chargés une fois — pas de re-fetch par fichier.
 */

interface ShikiHighlighter {
  codeToHtml(
    code: string,
    options: { lang: string; theme: string },
  ): string
}

interface ShikiModule {
  createHighlighter: (options: {
    themes: string[]
    langs: string[]
  }) => Promise<ShikiHighlighter>
}

/**
 * URL CDN du bundle web Shiki (le plus léger, sans loader d'OnigJS pour
 * Node). `@1` épingle la major version pour éviter les breaking changes.
 */
const SHIKI_CDN_URL = 'https://esm.sh/shiki@1.29.2'

const SUPPORTED_LANGS = ['vue', 'typescript', 'javascript', 'scss', 'css', 'json'] as const
const DEFAULT_THEME = 'github-light'

type SupportedLang = (typeof SUPPORTED_LANGS)[number]

let _highlighterPromise: Promise<ShikiHighlighter> | null = null

/**
 * Récupère (ou crée) le singleton highlighter. Premier appel : fetch CDN,
 * parse grammars/themes, retourne une promesse. Appels suivants : retourne
 * la même promesse résolue.
 */
function getHighlighter(): Promise<ShikiHighlighter> {
  if (_highlighterPromise) return _highlighterPromise

  _highlighterPromise = (async () => {
    const mod = (await import(/* @vite-ignore */ SHIKI_CDN_URL)) as ShikiModule
    return mod.createHighlighter({
      themes: [DEFAULT_THEME],
      langs: [...SUPPORTED_LANGS],
    })
  })()

  return _highlighterPromise
}

/**
 * Devine la grammar Shiki depuis l'extension du fichier. Tombe sur
 * `typescript` par défaut (le plus permissif).
 */
function langFromPath(path: string): SupportedLang {
  if (path.endsWith('.vue')) return 'vue'
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript'
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript'
  if (path.endsWith('.scss')) return 'scss'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  return 'typescript'
}

/**
 * Highlight du code en HTML prêt à injecter. Renvoie une chaîne de
 * `<pre class="shiki..."><code>...</code></pre>` que le composant
 * consumer pose via `v-html`. Si le highlighter rate (CDN down, etc.)
 * on fallback à un `<pre>` plain text pour ne pas casser le drawer.
 */
export async function highlightCode(
  code: string,
  filePath: string,
): Promise<string> {
  try {
    const highlighter = await getHighlighter()
    return highlighter.codeToHtml(code, {
      lang: langFromPath(filePath),
      theme: DEFAULT_THEME,
    })
  } catch (err) {
    console.error('[shiki] highlight failed, falling back to plain text', err)
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<pre class="shiki shiki-fallback"><code>${escaped}</code></pre>`
  }
}
