import { offsetFromRoot } from '@nx/devkit';
import type { Linter } from 'eslint';
import {
  eslintPluginImportVersion,
  eslintPluginReactVersion,
  eslintPluginReactHooksVersion,
  eslintPluginJsxA11yVersion,
} from './versions';

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    'eslint-plugin-import': eslintPluginImportVersion,
    'eslint-plugin-jsx-a11y': eslintPluginJsxA11yVersion,
    'eslint-plugin-react': eslintPluginReactVersion,
    'eslint-plugin-react-hooks': eslintPluginReactHooksVersion,
  },
};

export const extendReactEslintJson = (json: Linter.Config) => {
  const { extends: pluginExtends, ...config } = json;

  return {
    extends: ['plugin:@nx/react', ...(pluginExtends || [])],
    ...config,
  };
};
