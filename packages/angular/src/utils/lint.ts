export function createAngularLintConfig(options: {
  parserOptionsProject: string[];
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
         *
         * In a future PR we will also add in a section for Component HTML linting
         */
        files: ['*.ts'],
        parserOptions: {
          project: options.parserOptionsProject,
        },
        rules: {},
      },
    ],
  };
}
