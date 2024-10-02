import {
  cleanupProject,
  newProject,
  uniq,
  runCLI,
  ensurePlaywrightBrowsersInstallation,
  getPackageManagerCommand,
  getSelectedPackageManager,
  readJson,
} from '@nx/e2e/utils';

const TEN_MINS_MS = 600_000;

describe('Playwright E2E Test runner', () => {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

  beforeAll(() => {
    newProject({
      name: uniq('playwright'),
      packages: ['@nx/playwright', '@nx/web'],
    });
  });

  afterAll(() => cleanupProject());

  it(
    'should test and lint example app',

    () => {
      ensurePlaywrightBrowsersInstallation();

      runCLI(
        `g @nx/web:app demo-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-e2e --webServerCommand="${pmc.runNx} serve demo-e2e" --webServerAddress="http://localhost:4200"`
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
    () => {
      ensurePlaywrightBrowsersInstallation();

      runCLI(
        `g @nx/web:app demo-js-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-js-e2e --js  --webServerCommand="${pmc.runNx} serve demo-e2e" --webServerAddress="http://localhost:4200"`
      );

      const e2eResults = runCLI(`e2e demo-js-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const lintResults = runCLI(`lint demo-e2e`);
      expect(lintResults).toContain('Successfully ran target lint');
    },
    TEN_MINS_MS
  );
});

describe('Playwright E2E Test Runner - legacy', () => {
  let env: string | undefined;

  beforeAll(() => {
    env = process.env.NX_ADD_PLUGINS;
    newProject({
      name: uniq('playwright'),
    });
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterAll(() => {
    if (env) {
      process.env.NX_ADD_PLUGINS = env;
    } else {
      delete process.env.NX_ADD_PLUGINS;
    }
  });

  it(
    'should test and lint example app',

    () => {
      ensurePlaywrightBrowsersInstallation();

      const pmc = getPackageManagerCommand();

      runCLI(
        `g @nx/web:app demo-e2e --directory apps/demo-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-e2e --webServerCommand="${pmc.runNx} serve demo-e2e" --webServerAddress="http://localhost:4200"`
      );

      const e2eResults = runCLI(`e2e demo-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const { targets } = readJson('apps/demo-e2e/project.json');
      expect(targets.e2e).toBeDefined();
    },
    TEN_MINS_MS
  );

  it(
    'should test and lint example app with js',
    () => {
      ensurePlaywrightBrowsersInstallation();

      const pmc = getPackageManagerCommand();

      runCLI(
        `g @nx/web:app demo-js-e2e --directory apps/demo-js-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-js-e2e --js  --webServerCommand="${pmc.runNx} serve demo-e2e" --webServerAddress="http://localhost:4200"`
      );

      const e2eResults = runCLI(`e2e demo-js-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const { targets } = readJson('apps/demo-js-e2e/project.json');
      expect(targets.e2e).toBeDefined();
    },
    TEN_MINS_MS
  );
});
