import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, offsetFromRoot, writeJson } from '@nrwl/devkit';
import { stringUtils } from '@nrwl/workspace';
import type { AddLintingGeneratorSchema } from '../schema';

export function createEsLintConfiguration(
  tree: Tree,
  options: AddLintingGeneratorSchema
): void {
  const rootConfig = `${offsetFromRoot(options.projectRoot)}.eslintrc.json`;
  // Include all project files to be linted (since they are turned off in the root eslintrc file).
  const ignorePatterns = ['!**/*'];

  const configJson = {
    extends: [rootConfig],
    ignorePatterns,
    overrides: [
      {
        files: ['*.ts'],
        extends: [
          'plugin:@nrwl/nx/angular',
          'plugin:@angular-eslint/template/process-inline-templates',
        ],
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
        parserOptions: !options.setParserOptionsProject
          ? undefined
          : {
              project: [`${options.projectRoot}/tsconfig.*?.json`],
            },
        rules: {
          '@angular-eslint/directive-selector': [
            'error',
            {
              type: 'attribute',
              prefix: stringUtils.camelize(options.prefix),
              style: 'camelCase',
            },
          ],
          '@angular-eslint/component-selector': [
            'error',
            {
              type: 'element',
              prefix: stringUtils.dasherize(options.prefix),
              style: 'kebab-case',
            },
          ],
        },
      },
      {
        files: ['*.html'],
        extends: ['plugin:@nrwl/nx/angular-template'],
        /**
         * Having an empty rules object present makes it more obvious to the user where they would
         * extend things from if they needed to
         */
        rules: {},
      },
    ],
  };

  writeJson(
    tree,
    joinPathFragments(options.projectRoot, '.eslintrc.json'),
    configJson
  );
}
