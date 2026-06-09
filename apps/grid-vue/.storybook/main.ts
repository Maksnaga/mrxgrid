import type { StorybookConfig } from '@storybook/vue3-vite'
import { fileURLToPath } from 'node:url'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  // Serve the public/ directory at the dev-server root, so the
  // `/fonts/LeroyMerlinSans-Web-*.woff2` paths declared in
  // `.storybook/preview.css` resolve. Required for theming demos.
  staticDirs: ['../public'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  typescript: {
    check: false,
  },
  viteFinal: async (cfg) => {
    cfg.resolve ??= {}
    cfg.resolve.alias = {
      ...(cfg.resolve.alias as Record<string, string> | undefined),
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    }
    // Allow the deployed Storybook to be served under a subpath
    // (e.g. https://maksnaga.myasustor.com/adeo-grid/). Default to '/'
    // so local `storybook dev` keeps working at the root.
    if (process.env.STORYBOOK_BASE_PATH) {
      cfg.base = process.env.STORYBOOK_BASE_PATH
    }
    // Open CORS so the @adeo/storybook-portal (running on :6008) can
    // fetch this Storybook's `index.json` via Storybook Composition refs.
    //
    // Vite ships a built-in CORS middleware (enabled by default) that
    // emits `Access-Control-Allow-Origin: *`. Storybook Composition
    // uses `credentials: include` which the browser rejects against
    // `*`. We DISABLE Vite's CORS here, then a custom `enforce:'pre'`
    // plugin (below) echoes the exact Origin + adds
    // `Access-Control-Allow-Credentials: true` so Composition works.
    cfg.server = cfg.server ?? {}
    cfg.server.cors = false
    cfg.plugins = cfg.plugins ?? []
    cfg.plugins.push({
      name: 'sb-composition-cors',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Storybook Composition fetches /index.json with
          // `credentials: 'include'`. The spec forbids `Allow-Origin: *`
          // in that mode — must echo the exact request origin and set
          // `Allow-Credentials: true`. Storybook's own /index.json
          // handler calls `res.writeHead()` later which OVERWRITES
          // headers set via `setHeader`. We monkey-patch `writeHead`
          // to inject our CORS headers at every call.
          const origin = (req.headers.origin as string | undefined) ?? '*'
          const inject = (): void => {
            res.setHeader('Access-Control-Allow-Origin', origin)
            res.setHeader('Vary', 'Origin')
            res.setHeader('Access-Control-Allow-Credentials', 'true')
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', '*')
          }
          inject()
          const originalWriteHead = res.writeHead.bind(res) as typeof res.writeHead
          res.writeHead = function patchedWriteHead(...args: Parameters<typeof res.writeHead>): typeof res {
            inject()
            return originalWriteHead(...args)
          }
          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }
          next()
        })
      },
    })
    return cfg
  },
}

export default config
