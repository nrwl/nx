import {
  cleanupProject,
  killPort,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

const TEN_MINS_MS = 600_000;

describe('Cypress E2E Test runner (legacy)', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/angular', '@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it(
    'should run e2e in parallel',
    async () => {
      const ngApp1 = uniq('ng-app1');
      const ngApp2 = uniq('ng-app2');
      runCLI(
        `generate @nx/angular:app ${ngApp1} --e2eTestRunner=cypress --linter=eslint --no-interactive`,
        { env: { NX_ADD_PLUGINS: 'false' } }
      );
      runCLI(
        `generate @nx/angular:app ${ngApp2} --e2eTestRunner=cypress --linter=eslint --no-interactive`,
        { env: { NX_ADD_PLUGINS: 'false' } }
      );

      if (runE2ETests('cypress')) {
        const results = runCLI(
          `run-many --target=e2e --parallel=2 --port=cypress-auto --output-style=stream`
        );
        expect(results).toContain('Successfully ran target e2e for 2 projects');
      }
    },
    TEN_MINS_MS
  );

  it(
    `should allow CT and e2e in same project - react`,
    async () => {
      const appName = uniq(`react-cy-app`);
      runCLI(
        `generate @nx/react:app ${appName} --e2eTestRunner=none --no-interactive`,
        { env: { NX_ADD_PLUGINS: 'false' } }
      );
      runCLI(
        `generate @nx/react:component btn --project=${appName} --no-interactive`,
        { env: { NX_ADD_PLUGINS: 'false' } }
      );
      runCLI(
        `generate @nx/react:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`,
        { env: { NX_ADD_PLUGINS: 'false' } }
      );
      runCLI(`generate @nx/cypress:e2e --project=${appName} --no-interactive`, {
        env: { NX_ADD_PLUGINS: 'false' },
      });

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
