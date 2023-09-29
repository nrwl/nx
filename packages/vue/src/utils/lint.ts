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

export const extendVueEslintJson = (json: any) => {
  const { extends: pluginExtends, ...config } = json;

  return {
    extends: [
      'plugin:vue/vue3-essential',
      'eslint:recommended',
      '@vue/eslint-config-typescript',
      '@vue/eslint-config-prettier/skip-formatting',
      ...(pluginExtends || []),
    ],
    ...config,
  };
};
