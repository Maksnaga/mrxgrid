import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
//
// `base` est piloté par l'env `VITE_BASE` :
//   • dev local                 → '/' (défaut)
//   • build pour Asustor        → VITE_BASE=/mrxgrid-app/ npm run build:app
// Les assets générés sont alors préfixés correctement (`/mrxgrid-app/assets/…`).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    conditions: ['style', 'import', 'module', 'browser', 'default'],
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [fileURLToPath(new URL('./src', import.meta.url))],
        additionalData: `@use "styles/mozaic" as m;\n`,
      },
    },
  },
})
