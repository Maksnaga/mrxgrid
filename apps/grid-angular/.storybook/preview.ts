import type { Decorator, Preview } from '@storybook/angular';
import { addons } from 'storybook/preview-api';
import { setCompodocJson } from '@storybook/addon-docs/angular';
import docJson from '../documentation.json';
import DocsTemplate from './DocsTemplate.mdx';
import './styles.scss';
setCompodocJson(docJson);

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    options: {
      storySort: {
        method: 'alphabetical',
        // Mirrors the grid-vue sidebar (apps/grid-vue/.storybook/preview.ts)
        // so both Storybooks read the same way. Angular-only chapters
        // (Columns, Export) are slotted where they fit thematically.
        order: [
          'Stories',
          [
            'Introduction',
            'Basics',
            'Selection',
            'Editing',
            'Filtering',
            'Sorting',
            'Grouping',
            'Columns',
            'Virtual Scroll',
            'Pagination',
            'Lazy Loading',
            'Formula Engine',
            'Row Expansion',
            'Customization',
            'Export',
            'Devtools',
          ],
          '*',
        ],
      },
    },
    backgrounds: {
      options: {
        'Primary (default)': {
          name: 'Primary (default)',
          value: '#ffffff',
        },

        secondary: {
          name: 'Secondary',
          value: '#EBEBEB',
        },

        inverse: {
          name: 'Inverse',
          value: '#1A1A1A',
        },
      },
    },
    docs: {
      codePanel: true,
      canvas: { sourceState: 'shown' },
      toc: true,
      page: DocsTemplate,
    },
  },

  initialGlobals: {
    backgrounds: { value: 'primary' },
  },
  tags: ['autodocs'],
  globalTypes: {
    brand: {
      name: 'Brand',
      description: 'Brand Preset',
      defaultValue: 'leroymerlin',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'leroymerlin', title: 'LEROY MERLIN' },
          { value: 'adeo', title: 'ADEO' },
          { value: 'bricocenter', title: 'Bricocenter' },
          { value: 'mbrand', title: 'M Brand (Tecnomat, Obramat, Obramax, Bricoman)' },
        ],
        dynamicTitle: true,
      },
    },
    mode: {
      name: 'Mode',
      description: 'Light/Dark',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { icon: 'sun', value: 'light', title: 'Light' },
          { icon: 'moon', value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;

const BRAND_CLASSES: Record<string, string> = {
  leroymerlin: 'preset-lm',
  adeo: 'preset-adeo',
  bricocenter: 'preset-bricocenter',
  mbrand: 'preset-mbrand',
};

// clean html brand classes
function applyBrandOnRoot(rootEl: HTMLElement, className: string | undefined) {
  Object.values(BRAND_CLASSES).forEach((cls) => {
    cls.split(/\s+/).forEach((token) => token && rootEl.classList.remove(token));
  });
  if (className) {
    className.split(/\s+/).forEach((token) => token && rootEl.classList.add(token));
  }
}

// Apply defaults immediately at module load time so MDX pages get tokens on direct access
applyBrandOnRoot(document.documentElement, BRAND_CLASSES['leroymerlin']);
document.documentElement.setAttribute('data-theme', 'light');

// Retry until the channel is available (it may not be ready at module load time).
function subscribeToGlobals() {
  try {
    const channel = addons.getChannel();
    channel.on('globalsUpdated', ({ globals }: { globals: Record<string, string> }) => {
      if (globals['brand']) {
        applyBrandOnRoot(
          document.documentElement,
          BRAND_CLASSES[globals['brand']] ?? BRAND_CLASSES['leroymerlin']
        );
      }
      if (globals['mode']) {
        document.documentElement.setAttribute(
          'data-theme',
          globals['mode'] === 'dark' ? 'dark' : 'light'
        );
      }
    });
  } catch {
    setTimeout(subscribeToGlobals, 100);
  }
}
subscribeToGlobals();

const BrandDecorator: Decorator = (Story, context) => {
  const root = document.documentElement;
  const brandKey = context.globals['brand'] || 'leroymerlin';
  const className = BRAND_CLASSES[brandKey] || BRAND_CLASSES['leroymerlin'];
  applyBrandOnRoot(root, className);
  return Story();
};

const ModeDecorator: Decorator = (Story, context) => {
  const root = document.documentElement;
  const mode = context.globals['mode'] === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-theme', mode);
  return Story();
};

export const decorators = [BrandDecorator, ModeDecorator];
