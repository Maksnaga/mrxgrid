import type { StorybookConfig } from '@storybook/vue3-vite'
import { fileURLToPath } from 'node:url'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
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
    return cfg
  },
}

export default config
