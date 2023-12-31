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
      expect(lintResults).toContain('All files pass linting');
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
      expect(lintResults).toContain('All files pass linting');
    },
    TEN_MINS_MS
  );
});

describe('Playwright E2E Test Runner - PCV3', () => {
  let env: string | undefined;

  beforeAll(() => {
    env = process.env.NX_PCV3;
    newProject({
      name: uniq('playwright'),
      unsetProjectNameAndRootFormat: false,
    });
    process.env.NX_PCV3 = 'true';
  });

  afterAll(() => {
    if (env) {
      process.env.NX_PCV3 = env;
    } else {
      delete process.env.NX_PCV3;
    }
  });

  it(
    'should test and lint example app',

    () => {
      ensurePlaywrightBrowsersInstallation();

      const pmc = getPackageManagerCommand();

      runCLI(
        `g @nx/web:app demo-e2e --directory apps/demo-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive --projectNameAndRootFormat=as-provided`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-e2e --webServerCommand="${pmc.runNx} serve demo-e2e" --webServerAddress="http://localhost:4200"`
      );

      const e2eResults = runCLI(`e2e demo-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const { targets } = readJson('apps/demo-e2e/project.json');
      expect(targets?.e2e).not.toBeDefined();

      const { plugins } = readJson('nx.json');
      const playwrightPlugin = plugins?.find(
        (p) => p.plugin === '@nx/playwright/plugin'
      );
      expect(playwrightPlugin).toMatchInlineSnapshot(`
        {
          "options": {
            "targetName": "e2e",
          },
          "plugin": "@nx/playwright/plugin",
        }
      `);
    },
    TEN_MINS_MS
  );

  it(
    'should test and lint example app with js',
    () => {
      ensurePlaywrightBrowsersInstallation();

      const pmc = getPackageManagerCommand();

      runCLI(
        `g @nx/web:app demo-js-e2e --directory apps/demo-js-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive --projectNameAndRootFormat=as-provided`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-js-e2e --js  --webServerCommand="${pmc.runNx} serve demo-e2e" --webServerAddress="http://localhost:4200"`
      );

      const e2eResults = runCLI(`e2e demo-js-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const { targets } = readJson('apps/demo-js-e2e/project.json');
      expect(targets?.e2e).not.toBeDefined();

      const { plugins } = readJson('nx.json');
      const playwrightPlugin = plugins?.find(
        (p) => p.plugin === '@nx/playwright/plugin'
      );
      expect(playwrightPlugin).toMatchInlineSnapshot(`
        {
          "options": {
            "targetName": "e2e",
          },
          "plugin": "@nx/playwright/plugin",
        }
      `);
    },
    TEN_MINS_MS
  );
});
