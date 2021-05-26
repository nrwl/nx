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
        parserOptions: {
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
