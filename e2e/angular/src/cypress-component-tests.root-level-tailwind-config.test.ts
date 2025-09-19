import { checkFilesDoNotExist, checkFilesExist, cleanupProject, createFile, newProject, removeFile, runCLI, runE2ETests, uniq } from '@nx/e2e-utils';

describe('Angular Cypress Component Tests - root level tailwind config', () => {
  beforeAll(async () => {
    newProject({ name: uniq('cy-ng'), packages: ['@nx/angular'] });
  });

  afterAll(() => cleanupProject());

  it('should use root level tailwinds config', () => {
    const buildableLibName = uniq('cy-angular-buildable-lib');
    runCLI(`generate @nx/angular:lib ${buildableLibName} --buildable --no-interactive`);

    createFile(
      'tailwind.config.js',
      `const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [join(__dirname, '**/*.{html,js,ts}')],
  theme: {
    extend: {},
  },
  plugins: [],
};
`
    );
    removeFile(join(buildableLibName, 'tailwind.config.js'));

    checkFilesExist('tailwind.config.js');
    checkFilesDoNotExist(`${buildableLibName}/tailwind.config.js`);

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${buildableLibName}:build --no-interactive`
    );

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});


