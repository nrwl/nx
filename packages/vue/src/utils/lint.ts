import {
  eslintPluginVueVersion,
  vueEslintConfigPrettierVersion,
  vueEslintConfigTypescriptVersion,
} from './versions';

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    '@vue/eslint-config-prettier': vueEslintConfigPrettierVersion,
    '@vue/eslint-config-typescript': vueEslintConfigTypescriptVersion,
    'eslint-plugin-vue': eslintPluginVueVersion,
  },
};
