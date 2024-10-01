import {
  checkFilesExist,
  cleanupProject,
  createFile,
  killPort,
  newProject,
  readJson,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

const TEN_MINS_MS = 600_000;

describe('Cypress E2E Test runner', () => {
  const myapp = uniq('myapp');

  beforeAll(() => {
    newProject({ packages: ['@nx/angular', '@nx/next', '@nx/react'] });
  });

  afterAll(() => cleanupProject());

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
        await killPort(4200);
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
        await killPort(4200);

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

        expect(await killPort(4200)).toBeTruthy();
      }
    },
    TEN_MINS_MS
  );

  it(
    `should allow CT and e2e in same project for a next project`,
    async () => {
      const appName = uniq('next-cy-app');
      runCLI(
        `generate @nx/next:app apps/${appName} --e2eTestRunner=none --no-interactive `
      );
      runCLI(
        `generate @nx/next:component apps/${appName}/components/btn --no-interactive`
      );
      runCLI(
        `generate @nx/next:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
      );
      runCLI(
        `generate @nx/cypress:configuration --project=${appName} --devServerTarget=${appName}:dev --baseUrl=http://localhost:3000 --no-interactive`
      );

      if (runE2ETests('cypress')) {
        expect(runCLI(`run ${appName}:component-test`)).toContain(
          'All specs passed!'
        );
        expect(runCLI(`run ${appName}:e2e`)).toContain('All specs passed!');
      }
      expect(await killPort(4200)).toBeTruthy();
    },
    TEN_MINS_MS
  );

  it(
    `should allow CT and e2e in same project for an angular project`,
    async () => {
      let appName = uniq(`angular-cy-app`);
      runCLI(
        `generate @nx/angular:app apps/${appName} --e2eTestRunner=none --no-interactive --bundler=webpack`
      );
      runCLI(
        `generate @nx/angular:component apps/${appName}/src/app/btn/btn --no-interactive`
      );
      runCLI(
        `generate @nx/angular:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
      );
      runCLI(
        `generate @nx/cypress:e2e --project=${appName} --baseUrl=http://localhost:4200 --no-interactive`
      );

      if (runE2ETests('cypress')) {
        expect(runCLI(`run ${appName}:component-test`)).toContain(
          'All specs passed!'
        );
        expect(runCLI(`run ${appName}:e2e`)).toContain('All specs passed!');
      }
      expect(await killPort(4200)).toBeTruthy();
    },
    TEN_MINS_MS
  );
});
