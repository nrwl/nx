import {
  checkFilesExist,
  copyMissingPackages,
  newApp,
  newProject,
  readJson,
  runCLI
} from '../utils';

describe('Cypress E2E Test runner', () => {
  describe('project scaffolding', () => {
    it(
      'should generate an app with the Cypress as e2e test runner',
      () => {
        newProject();
        newApp('myApp --e2eTestRunner=cypress');
        copyMissingPackages();

        // Making sure the package.json file contains the Cypress dependency
        const packageJson = readJson('package.json');
        expect(packageJson.devDependencies['cypress']).toBeTruthy();

        // Making sure the cypress folders & files are created
        checkFilesExist('apps/my-app-e2e/cypress.json');
        checkFilesExist('apps/my-app-e2e/tsconfig.json');

        checkFilesExist('apps/my-app-e2e/cypress/support/index.ts');
        checkFilesExist('apps/my-app-e2e/cypress/support/commands.ts');

        checkFilesExist('apps/my-app-e2e/src/fixtures/example.json');
        checkFilesExist('apps/my-app-e2e/src/integration/app.spec.ts');
        checkFilesExist('apps/my-app-e2e/src/plugins/index.ts');
        checkFilesExist('apps/my-app-e2e/src/support/app.po.ts');
      },
      1000000
    );
  });

  describe('running Cypress', () => {
    it(
      'should run an app and executing e2e tests with Cypress',
      () => {
        newProject();
        newApp('myApp --e2eTestRunner=cypress');
        copyMissingPackages();

        expect(runCLI('e2e --project=my-app-e2e --headless')).toContain(
          'All specs passed!'
        );
      },
      1000000
    );
  });
});
