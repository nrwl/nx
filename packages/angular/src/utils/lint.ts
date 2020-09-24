export function createAngularLintConfig(options: {
  parserOptionsProject: string[];
  createDefaultProgram: boolean;
}) {
  return {
    overrides: [
      {
        /**
         * -----------------------------------------------------
         * TYPESCRIPT FILES
         * -----------------------------------------------------
         *
         * Configuration within this section is common to all .ts
         * files in the project.
         */
        files: ['*.ts'],
        parserOptions: {
          project: options.parserOptionsProject,
          /**
           * The `createDefaultProgram` fallback should rarely be used as it can facilitate
           * highly non-performant lint configurations, however it is required specifically
           * for Angular applications because of the use of the somewhat magical environment.prod.ts
           * etc files which are not referenced within any configured tsconfig.
           *
           * More information about the option can be found here:
           * https://github.com/typescript-eslint/typescript-eslint/tree/f887ab51f58c1b3571f9a14832864bc0ca59623f/packages/parser#parseroptionscreatedefaultprogram
           */
          createDefaultProgram: options.createDefaultProgram || undefined,
        },
        rules: {},
      },
    ],
  };
}
