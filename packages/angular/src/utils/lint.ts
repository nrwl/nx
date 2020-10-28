import { angularEslintVersion } from './versions';

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    '@angular-eslint/eslint-plugin': angularEslintVersion,
    '@angular-eslint/eslint-plugin-template': angularEslintVersion,
    '@angular-eslint/template-parser': angularEslintVersion,
  },
};

export const createAngularEslintJson = (projectRoot: string) => ({
  overrides: [
    {
      files: ['*.ts'],
      extends: ['plugin:@nrwl/nx/angular-code'],
      parserOptions: {
        project: [`${projectRoot}/tsconfig.*?.json`],
      },
      /**
       * Having an empty rules object present makes it more obvious to the user where they would
       * extend things from if they needed to
       */
      rules: {},
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
    {
      files: ['*.component.ts'],
      extends: ['plugin:@angular-eslint/template/process-inline-templates'],
      settings: {
        NX_DOCUMENTATION_NOTE:
          'This entry in the overrides is only here to extract inline templates from Components, you should not configure rules here',
      },
    },
  ],
});
