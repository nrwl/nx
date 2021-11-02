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

export const createReactEslintJson = (
  projectRoot: string,
  setParserOptionsProject: boolean
): Linter.Config => ({
  extends: [
    'plugin:@nrwl/nx/react',
    `${offsetFromRoot(projectRoot)}.eslintrc.json`,
  ],
  ignorePatterns: ['!**/*'],
  overrides: [
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      /**
       * NOTE: We no longer set parserOptions.project by default when creating new projects.
       *
       * We have observed that users rarely add rules requiring type-checking to their Nx workspaces, and therefore
       * do not actually need the capabilites which parserOptions.project provides. When specifying parserOptions.project,
       * typescript-eslint needs to create full TypeScript Programs for you. When omitting it, it can perform a simple
       * parse (and AST tranformation) of the source files it encounters during a lint run, which is much faster and much
       * less memory intensive.
       *
       * In the rare case that users attempt to add rules requiring type-checking to their setup later on (and haven't set
       * parserOptions.project), the executor will attempt to look for the particular error typescript-eslint gives you
       * and provide feedback to the user.
       */
      parserOptions: !setParserOptionsProject
        ? undefined
        : {
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
