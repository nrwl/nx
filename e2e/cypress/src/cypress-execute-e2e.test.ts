import {
  checkFilesExist,
  createFile,
  readJson,
  runCLI,
  runE2ETests,
  updateFile,
} from '@nx/e2e-utils';
import { setupCypressTest, cleanupCypressTest } from './cypress-setup';

const TEN_MINS_MS = 600_000;

describe('Cypress E2E Test runner', () => {
  let myapp: string;

  beforeAll(() => {
    const context = setupCypressTest();
    myapp = context.myapp;
    runCLI(
      `generate @nx/react:app apps/${myapp} --e2eTestRunner=cypress --linter=eslint`
    );
  });

  afterAll(() => cleanupCypressTest());

  it(
    'should execute e2e tests using Cypress',
    async () => {
      // make sure env vars work
      createFile(
        `apps/${myapp}-e2e/cypress.env.json`,
        `
{
  "cypressEnvJson": "i am from the cypress.env.json file"
}`
      );

      createFile(
        `apps/${myapp}-e2e/src/e2e/env.cy.ts`,
        `
describe('env vars', () => {
  it('should have cli args', () => {
    assert.equal(Cypress.env('cliArg'), 'i am from the cli args');
  });

  it('should have cypress.env.json vars', () => {
    assert.equal(
      Cypress.env('cypressEnvJson'),
      'i am from the cypress.env.json file'
    );
  });
});`
      );

      if (runE2ETests('cypress')) {
        // contains the correct output and works
        const run1 = runCLI(
          `e2e ${myapp}-e2e --config \\'{\\"env\\":{\\"cliArg\\":\\"i am from the cli args\\"}}\\'`
        );
        expect(run1).toContain('All specs passed!');
        // tests should not fail because of a config change
        updateFile(
          `apps/${myapp}-e2e/cypress.config.ts`,
          `
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      webServerCommands: {
        default: 'nx run ${myapp}:serve',
        production: 'nx run ${myapp}:preview',
      },
      ciWebServerCommand: 'nx run ${myapp}:serve-static',
      webServerConfig: {
        timeout: 60_000,
      },
    }),
    baseUrl: 'http://localhost:4200',
  },
  env: {
    fromCyConfig: 'i am from the cypress config file'
  }
});`
        );

        const run2 = runCLI(
          `e2e ${myapp}-e2e --config \\'{\\"env\\":{\\"cliArg\\":\\"i am from the cli args\\"}}\\'`
        );
        expect(run2).toContain('All specs passed!');

        // make sure project.json env vars also work
        checkFilesExist(`apps/${myapp}-e2e/src/e2e/env.cy.ts`);
        updateFile(
          `apps/${myapp}-e2e/src/e2e/env.cy.ts`,
          `
        describe('env vars', () => {
          it('should not have cli args', () => {
            assert.equal(Cypress.env('cliArg'), undefined);
          });

          it('should have cypress.env.json vars', () => {
            assert.equal(
              Cypress.env('cypressEnvJson'),
              'i am from the cypress.env.json file'
            );
          });

          it('should have cypress config vars', () => {
            assert.equal(
              Cypress.env('fromCyConfig'),
              'i am from the cypress config file'
            );
          });
        });`
        );
        const run3 = runCLI(`e2e ${myapp}-e2e`);
        expect(run3).toContain('All specs passed!');
      }
    },
    TEN_MINS_MS
  );
});
