import { offsetFromRoot } from '@nrwl/devkit';
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

export const createReactEslintJson = (projectRoot: string): Linter.Config => ({
  extends: [
    'plugin:@nrwl/nx/react',
    `${offsetFromRoot(projectRoot)}.eslintrc.json`,
  ],
  ignorePatterns: ['!**/*'],
  overrides: [
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      parserOptions: {
        /**
         * In order to ensure maximum efficiency when typescript-eslint generates TypeScript Programs
         * behind the scenes during lint runs, we need to make sure the project is configured to use its
         * own specific tsconfigs, and not fall back to the ones in the root of the workspace.
         */
        project: [`${projectRoot}/tsconfig.*?.json`],
      },
      /**
       * Having an empty rules object present makes it more obvious to the user where they would
       * extend things from if they needed to
       */
      rules: {},
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
    {
      files: ['*.js', '*.jsx'],
      rules: {},
    },
  ],
});
