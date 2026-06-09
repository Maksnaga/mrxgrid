import { create } from 'storybook/theming/create';
import logo from './assets/sidebar-logo.svg';

export default create({
  base: 'light',

  // ✨ Branding
  brandTitle: 'Mozaic-Angular',
  brandUrl: 'https://github.com/adeo/mozaic-angular',
  brandImage: logo,

  // 🎨 Primary Colors
  colorPrimary: '#0ECC83',
  colorSecondary: '#0ECC83',

  // 🧭 UI
  appBg: '#EAEDEF',
  appContentBg: '#FFFFFF',
  appPreviewBg: '#FFFFFF',
  appBorderColor: '#CDD4D8',
  appBorderRadius: 4,

  // 🖋️ Text
  textColor: '#000000',
  textInverseColor: '#FFFFFF',

  // 🧰 Toolbar
  barTextColor: '#000000',
  barSelectedColor: '#000000',
  barHoverColor: '#000000',
  barBg: '#FFFFFF',

  // 🪄 Forms
  inputBg: '#FFFFFF',
  inputBorder: '#CDD4D8',
  inputTextColor: '#000000',
  inputBorderRadius: 4,
});
