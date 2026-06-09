import type { StorybookConfig } from '@storybook/html-vite'

const config: StorybookConfig = {
  // Portal hosts the shared MDX docs only (Welcome, Architecture,
  // Runbook, Spec mutualisée). The framework-specific Storybooks live
  // in their own dev servers (:6006 Vue, :6007 Angular) and are opened
  // in separate tabs in dev. See the Welcome page for direct links.
  stories: ['../stories/**/*.mdx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-links'],
  framework: '@storybook/html-vite',
  // Serve the public/ directory at root so the brand logo
  // (.storybook/manager.tsx → theme.brandImage = '/adeo-grid-logo.svg') resolves.
  staticDirs: ['../public'],
}

export default config
