import { nuxtEslintConfigVersion } from './versions';

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    '@nuxt/eslint-config': nuxtEslintConfigVersion,
  },
};

export const extendNuxtEslintJson = (json: any) => {
  const { extends: pluginExtends, ...config } = json;

  return {
    extends: ['@nuxt/eslint-config', ...(pluginExtends || [])],
    ignorePatterns: ['.nuxt', 'node_modules', '.output'],
    ...config,
  };
};
