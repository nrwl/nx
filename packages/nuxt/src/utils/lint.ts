import {
  eslintPluginVueVersion,
  vueEslintConfigPrettierVersion,
  vueEslintConfigTypescriptVersion,
} from '@nx/vue';
import { nuxtEslintConfigTypescriptVersion } from './versions';

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    '@nuxtjs/eslint-config-typescript': nuxtEslintConfigTypescriptVersion,
    'eslint-plugin-vue': eslintPluginVueVersion,
    '@vue/eslint-config-prettier': vueEslintConfigPrettierVersion,
    '@vue/eslint-config-typescript': vueEslintConfigTypescriptVersion,
  },
};

export const extendNuxtEslintJson = (json: any) => {
  const { extends: pluginExtends, ...config } = json;

  return {
    extends: [
      'eslint:recommended',
      '@nuxtjs/eslint-config-typescript',
      'plugin:vue/vue3-essential',
      '@vue/eslint-config-typescript',
      '@vue/eslint-config-prettier/skip-formatting',
      ...(pluginExtends || []),
    ],
    ignorePatterns: ['.nuxt', 'node_modules', '.output'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
    ...config,
  };
};
