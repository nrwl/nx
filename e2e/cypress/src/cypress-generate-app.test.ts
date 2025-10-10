import { checkFilesExist, readJson, runCLI } from '@nx/e2e-utils';
import { setupCypressTest, cleanupCypressTest } from './cypress-setup';

const TEN_MINS_MS = 600_000;

describe('Cypress E2E Test runner', () => {
  let myapp: string;

  beforeAll(() => {
    const context = setupCypressTest();
    myapp = context.myapp;
  });

  afterAll(() => cleanupCypressTest());

  it(
    'should generate an app with the Cypress as e2e test runner',
    () => {
      runCLI(
        `generate @nx/react:app apps/${myapp} --e2eTestRunner=cypress --linter=eslint`
      );

      // Making sure the package.json file contains the Cypress dependency
      const packageJson = readJson('package.json');
      expect(packageJson.devDependencies['cypress']).toBeTruthy();

      // Making sure the cypress folders & files are created
      checkFilesExist(`apps/${myapp}-e2e/cypress.config.ts`);
      checkFilesExist(`apps/${myapp}-e2e/tsconfig.json`);

      checkFilesExist(`apps/${myapp}-e2e/src/fixtures/example.json`);
      checkFilesExist(`apps/${myapp}-e2e/src/e2e/app.cy.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/app.po.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/e2e.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/commands.ts`);
    },
    TEN_MINS_MS
  );
});
