import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  ensureCypressInstallation,
  killPort,
  newProject,
  readJson,
  runCLI,
  runCypressTests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

const TEN_MINS_MS = 600_000;
describe('Cypress E2E Test runner', () => {
  const myapp = uniq('myapp');

  beforeAll(() => {
    newProject();
    ensureCypressInstallation();
  });

  afterAll(() => cleanupProject());

  it(
    'should generate an app with the Cypress as e2e test runner',
    () => {
      runCLI(
        `generate @nx/react:app ${myapp} --e2eTestRunner=cypress --linter=eslint`
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

      updateJson(`apps/${myapp}-e2e/project.json`, (json) => {
        json.targets.e2e.options = {
          ...json.targets.e2e.options,
          env: {
            projectJson: 'i am from the nx project json file',
          },
        };
        return json;
      });
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

  it('cli args should not merged project.json vars', () => {
    assert.equal(
      Cypress.env('projectJson'),
      undefined
    );
  });
});`
      );

      // contains the correct output and works
      const run1 = runCLI(
        `e2e ${myapp}-e2e --no-watch --env.cliArg="i am from the cli args"`
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
  ...nxE2EPreset(__dirname),
  fixturesFolder: undefined,
  },
});`
      );

      const run2 = runCLI(
        `e2e ${myapp}-e2e --no-watch --env.cliArg="i am from the cli args"`
      );
      expect(run2).toContain('All specs passed!');
      await killPort(4200);

      // make sure project.json env vars also work
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

  it('should have project.json vars', () => {
    assert.equal(
      Cypress.env('projectJson'),
      'i am from the nx project json file'
    );
  });
});`
      );
      const run3 = runCLI(`e2e ${myapp}-e2e --no-watch`);
      expect(run3).toContain('All specs passed!');

      expect(await killPort(4200)).toBeTruthy();
    },
    TEN_MINS_MS
  );

  it('should run e2e in parallel', async () => {
    // ensure ports are free before running tests
    await killPort(4200);

    const ngAppName = uniq('ng-app');
    runCLI(
      `generate @nx/angular:app ${ngAppName} --e2eTestRunner=cypress --linter=eslint --no-interactive`
    );

    const results = runCLI(
      `run-many --target=e2e --parallel=2 --port=cypress-auto --output-style=stream`
    );
    expect(results).toContain('Using port 4200');
    expect(results).toContain('Using port 4201');
    expect(results).toContain('Successfully ran target e2e for 2 projects');
    checkFilesDoNotExist(
      `node_modules/@nx/cypress/src/executors/cypress/4200.txt`,
      `node_modules/@nx/cypress/src/executors/cypress/4201.txt`
    );
  });

  it(
    'should allow CT and e2e in the same project',
    async () => {
      await testCtAndE2eInProject('next');
      await testCtAndE2eInProject('angular');
      await testCtAndE2eInProject('react');
    },
    TEN_MINS_MS
  );
});

async function testCtAndE2eInProject(
  projectType: 'react' | 'next' | 'angular'
) {
  let appName = uniq(`${projectType}-cy-app`);
  runCLI(
    `generate @nx/${projectType}:app ${appName} --e2eTestRunner=none --no-interactive`
  );
  runCLI(
    `generate @nx/${projectType}:component btn --project=${appName} --no-interactive`
  );

  runCLI(
    `generate @nx/${projectType}:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
  );

  if (runCypressTests()) {
    expect(runCLI(`run ${appName}:component-test --no-watch`)).toContain(
      'All specs passed!'
    );
  }

  runCLI(`generate @nx/cypress:e2e --project=${appName} --no-interactive`);

  if (runCypressTests()) {
    expect(runCLI(`run ${appName}:e2e --no-watch`)).toContain(
      'All specs passed!'
    );
  }
  expect(await killPort(4200)).toBeTruthy();
}
