import {
  checkFilesExist,
  killPorts,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Cypress E2E Test runner', () => {
  const myapp = uniq('myapp');
  beforeAll(() => {
    newProject();
  });
  it('should generate an app with the Cypress as e2e test runner', () => {
    runCLI(
      `generate @nrwl/react:app ${myapp} --e2eTestRunner=cypress --linter=eslint`
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
  }, 1000000);

  it('should execute e2e tests using Cypress', async () => {
    // contains the correct output and works
    const run1 = runCLI(`e2e ${myapp}-e2e --no-watch`);
    expect(run1).toContain('All specs passed!');

    await killPorts(4200);
    // tests should not fail because of a config change
    updateFile(
      `apps/${myapp}-e2e/cypress.config.ts`,
      `
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
  ...nxE2EPreset(__dirname),
  fixturesFolder: undefined,
  }
  ,
});`
    );

    const run2 = runCLI(`e2e ${myapp}-e2e --no-watch`);
    expect(run2).toContain('All specs passed!');
    expect(await killPorts(4200)).toBeTruthy();
  }, 1000000);
});
