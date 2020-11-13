import {
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  runCLI,
  supportUi,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Cypress E2E Test runner', () => {
  describe('project scaffolding', () => {
    it('should generate an app with the Cypress as e2e test runner', () => {
      newProject();
      const myapp = uniq('myapp');
      runCLI(
        `generate @nrwl/react:app ${myapp} --e2eTestRunner=cypress --linter=eslint`
      );

      // Making sure the package.json file contains the Cypress dependency
      const packageJson = readJson('package.json');
      expect(packageJson.devDependencies['cypress']).toBeTruthy();

      // Making sure the cypress folders & files are created
      checkFilesExist(`apps/${myapp}-e2e/cypress.json`);
      checkFilesExist(`apps/${myapp}-e2e/tsconfig.e2e.json`);

      checkFilesExist(`apps/${myapp}-e2e/src/fixtures/example.json`);
      checkFilesExist(`apps/${myapp}-e2e/src/integration/app.spec.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/plugins/index.js`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/app.po.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/index.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/commands.ts`);
    }, 1000000);
  });

  if (supportUi()) {
    describe('running Cypress', () => {
      it('should execute e2e tests using Cypress', () => {
        newProject();
        const myapp = uniq('myapp');
        runCLI(
          `generate @nrwl/react:app ${myapp} --e2eTestRunner=cypress --linter=eslint`
        );

        expect(runCLI(`e2e ${myapp}-e2e --headless --no-watch`)).toContain(
          'All specs passed!'
        );

        const originalContents = JSON.parse(
          readFile(`apps/${myapp}-e2e/cypress.json`)
        );
        delete originalContents.fixturesFolder;
        updateFile(
          `apps/${myapp}-e2e/cypress.json`,
          JSON.stringify(originalContents)
        );

        expect(runCLI(`e2e ${myapp}-e2e --headless --no-watch`)).toContain(
          'All specs passed!'
        );
      }, 1000000);
    });
  }
});
