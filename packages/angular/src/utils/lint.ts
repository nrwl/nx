import type { TargetDefinition } from '@angular-devkit/core/src/workspace';
import { angularEslintVersion } from './versions';

export function createAngularProjectESLintLintTarget(
  projectRoot: string
): TargetDefinition {
  return {
    builder: '@nrwl/linter:eslint',
    options: {
      lintFilePatterns: [
        `${projectRoot}/src/**/*.ts`,
        `${projectRoot}/src/**/*.html`,
      ],
    },
  };
}

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    '@angular-eslint/eslint-plugin': angularEslintVersion,
    '@angular-eslint/eslint-plugin-template': angularEslintVersion,
    '@angular-eslint/template-parser': angularEslintVersion,
  },
};

export const createAngularEslintJson = (
  projectRoot: string,
  prefix: string
) => ({
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@nrwl/nx/angular',
        'plugin:@angular-eslint/template/process-inline-templates',
      ],
      parserOptions: {
        project: [`${projectRoot}/tsconfig.*?.json`],
      },
      rules: {
        '@angular-eslint/directive-selector': [
          'error',
          { type: 'attribute', prefix, style: 'camelCase' },
        ],
        '@angular-eslint/component-selector': [
          'error',
          { type: 'element', prefix, style: 'kebab-case' },
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
});
