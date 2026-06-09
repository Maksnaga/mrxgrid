import type { StorybookConfig } from '@analogjs/storybook-angular';
import { mergeConfig, type Plugin } from 'vite';

// Middleware plugin that attaches CORS headers ahead of Storybook's own
// routes — required for Storybook Composition (`refs`) since Storybook 10
// silently ignores the `server.cors` config option.
//
// `enforce: 'pre'` makes Vite call this plugin's `configureServer` BEFORE
// any other plugin's (incl. Storybook's framework plugin), which means
// our middleware is added to the Connect chain FIRST and runs before
// Storybook's own `/index.json` handler. Without `pre`, Storybook's
// handler intercepts the request before we get a chance to set headers.
const corsPlugin: Plugin = {
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
      const origin = (req.headers.origin as string | undefined) ?? '*';
      const inject = (): void => {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
      };
      inject();
      const originalWriteHead = res.writeHead.bind(res) as typeof res.writeHead;
      res.writeHead = function patchedWriteHead(...args: Parameters<typeof res.writeHead>): typeof res {
        inject();
        return originalWriteHead(...args);
      };
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      next();
    });
  },
};

const config: StorybookConfig = {
  // Single glob matches both *.stories.ts and *.stories.mdx (and standalone
  // *.mdx if any are added later). Avoid a separate `*.mdx` pattern that
  // logs "No story files found" warnings on every start.
  stories: ['../projects/grid-angular/src/**/*.stories.@(ts|mdx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-themes',
    '@storybook/addon-links',
    '@storybook/addon-a11y',
    'storybook-addon-tag-badges',
  ],
  framework: {
    name: '@analogjs/storybook-angular',
    options: {
      inlineStylesExtension: 'scss',
    },
  },
  staticDirs: ['assets'],
  async viteFinal(viteConfig) {
    // Disable Vite's built-in CORS middleware (which emits
    // `Access-Control-Allow-Origin: *`) so our custom `corsPlugin`
    // below can echo the real Origin + add `Allow-Credentials: true`.
    // Storybook Composition uses `credentials: include` which the
    // browser rejects against `*`.
    viteConfig.server = viteConfig.server ?? {};
    viteConfig.server.cors = false;
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          '@storybook/angular/dist/client/index.js': '@storybook/angular',
        },
      },
      plugins: [corsPlugin],
      css: {
        preprocessorOptions: {
          scss: {
            additionalData: (content: string, filepath: string) => {
              if (
                filepath.includes('node_modules') ||
                filepath.includes('?analog-inline') ||
                content.trimStart().startsWith('@use') ||
                content.trimStart().startsWith('export default')
              ) {
                return content;
              }
              return `@use '@mozaic-ds/tokens/theming';\n${content}`;
            },
          },
        },
      },
    });
  },
};
export default config;
