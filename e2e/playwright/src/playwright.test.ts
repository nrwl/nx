import {
  cleanupProject,
  createFile,
  ensurePlaywrightBrowsersInstallation,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  readFile,
  readJson,
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
    'should keep the server inputs out of atomized specs with "@nx-ultracache: imports"',
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
        `// @nx-ultracache: imports\nimport '../../${app}/src/app/feature';\n${readFile(
          `apps/${app}-e2e/src/example.spec.ts`
        )}`
      );

      const { targets } = JSON.parse(runCLI(`show project ${app}-e2e --json`));
      expect(targets['e2e-ci--src/example.spec.ts'].dependsOn).toEqual([
        { projects: [app], target: 'preview' },
        { target: 'e2e--wait-for-webserver' },
      ]);
      expect(targets['e2e-ci--src/feature.spec.ts'].dependsOn).toEqual([
        { projects: [app], target: 'preview', inputs: false },
        { target: 'e2e--wait-for-webserver' },
      ]);

      expect(runCLI(`lint ${app}-e2e`)).toContain(
        'Successfully ran target lint'
      );
    },
    TEN_MINS_MS
  );
});

describe('Playwright E2E Test Runner - legacy', () => {
  let env: string | undefined;

  beforeAll(() => {
    env = process.env.NX_ADD_PLUGINS;
    newProject({
      keepBackup: true,
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

    async () => {
      ensurePlaywrightBrowsersInstallation();

      const pmc = getPackageManagerCommand();
      const port = await reservePort();

      runCLI(
        `g @nx/web:app demo-e2e --directory apps/demo-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-e2e --webServerCommand="${pmc.runNx} serve demo-e2e --port=${port}" --webServerAddress="http://localhost:${port}"`
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
    async () => {
      ensurePlaywrightBrowsersInstallation();

      const pmc = getPackageManagerCommand();
      const port = await reservePort();

      runCLI(
        `g @nx/web:app demo-js-e2e --directory apps/demo-js-e2e --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
      );
      runCLI(
        `g @nx/playwright:configuration --project demo-js-e2e --js  --webServerCommand="${pmc.runNx} serve demo-e2e --port=${port}" --webServerAddress="http://localhost:${port}"`
      );

      const e2eResults = runCLI(`e2e demo-js-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');

      const { targets } = readJson('apps/demo-js-e2e/project.json');
      expect(targets.e2e).toBeDefined();
    },
    TEN_MINS_MS
  );
});
