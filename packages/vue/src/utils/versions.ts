import { join } from 'path';

export const nxVersion = require(join('@nx/vue', 'package.json')).version;

// Lowest Vue major the plugin supports. Vue 2 is EOL (2023-12-31); the plugin
// has only ever shipped Vue 3 support.
export const minSupportedVueVersion = '3.0.0';

// vue core
export const vueVersion = '^3.5.13';
export const vueTscVersion = '^2.2.8';
export const vueRouterVersion = '^4.5.0';

// test deps
export const vueTestUtilsVersion = '^2.4.6';
export const vitePluginVueVersion = '^6.0.1';

// linting deps
export const vueEslintConfigPrettierVersion = '^10.2.0';
export const vueEslintConfigTypescriptVersion = '^14.6.0';
export const eslintPluginVueVersion = '^9.16.1';

export const postcssVersion = '8.4.21';
export const autoprefixerVersion = '10.4.13';

// other deps
export const sassVersion = '^1.97.2';
