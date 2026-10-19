import {
  cleanupProject,
  createFile,
  ensurePlaywrightBrowsersInstallation,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  readFile,
  reservePort,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

const TEN_MINS_MS = 600_000;

describe('Playwright E2E Test runner', () => {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

  beforeAll(() => {
    newProject({
      keepBackup: true,
      name: uniq('playwright'),
      packages: ['@nx/playwright', '@nx/eslint', '@nx/web', '@nx/vite'],
    });
  });

  afterAll(() => cleanupProject());

  it(
    'should test and lint example app',

    async () => {
      ensurePlaywrightBrowsersInstallation();

      const port = await reservePort();
      runCLI(
        `g @nx/web:app demo-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-e2e --webServerCommand="${pmc.runNx} serve demo-e2e --port=${port}" --webServerAddress="http://localhost:${port}"`
      );

      const e2eResults = runCLI(`e2e demo-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const lintResults = runCLI(`lint demo-e2e`);
      expect(lintResults).toContain('Successfully ran target lint');
    },
    TEN_MINS_MS
  );

  it(
    'should test and lint example app with js',
    async () => {
      ensurePlaywrightBrowsersInstallation();

      const port = await reservePort();
      runCLI(
        `g @nx/web:app demo-js-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-js-e2e --js  --webServerCommand="${pmc.runNx} serve demo-e2e --port=${port}" --webServerAddress="http://localhost:${port}"`
      );

      const e2eResults = runCLI(`e2e demo-js-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const lintResults = runCLI(`lint demo-e2e`);
      expect(lintResults).toContain('Successfully ran target lint');
    },
    TEN_MINS_MS
  );

  it(
    'should keep the server inputs out of atomized specs with "@nx-ignore-server-inputs"',
    () => {
      const app = uniq('app');
      runCLI(
        `g @nx/web:app apps/${app} --unitTestRunner=none --bundler=vite --e2eTestRunner=playwright --linter=eslint --style=css --no-interactive`
      );
      createFile(
        `apps/${app}/src/app/feature.ts`,
        `export const feature = 'feature';\n`
      );
      createFile(
        `apps/${app}-e2e/src/feature.spec.ts`,
        `// @nx-ignore-server-inputs\nimport '../../${app}/src/app/feature';\n${readFile(
          `apps/${app}-e2e/src/example.spec.ts`
        )}`
      );

      const { targets } = JSON.parse(runCLI(`show project ${app}-e2e --json`));
      expect(targets['e2e-ci--src/example.spec.ts'].dependsOn).toEqual([
        { projects: [app], target: 'preview', waitFor: 'ready' },
        { target: 'e2e--wait-for-webserver' },
      ]);
      expect(targets['e2e-ci--src/feature.spec.ts'].dependsOn).toEqual([
        { projects: [app], target: 'preview', waitFor: 'ready', inputs: false },
        { target: 'e2e--wait-for-webserver' },
      ]);

      expect(runCLI(`lint ${app}-e2e`)).toContain(
        'Successfully ran target lint'
      );
    },
    TEN_MINS_MS
  );
});
