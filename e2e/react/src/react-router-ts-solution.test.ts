import {
  checkFilesExist,
  cleanupProject,
  ensureCypressInstallation,
  ensurePlaywrightBrowsersInstallation,
  killPorts,
  newProject,
  readFile,
  reservePort,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';

describe('React Router Applications - TS Solution', () => {
  const appName = uniq('app');
  // Every case here starts a dev server on the 4200 default, as does the sibling
  // react-router-ts-paths suite running in parallel on the same agent. Whoever
  // loses the race relocates to 4201 while Playwright still navigates to 4200.
  let appPort: number;
  beforeAll(async () => {
    newProject({
      preset: 'ts',
      packages: [
        '@nx/react',
        '@nx/vite',
        '@nx/vitest',
        '@nx/jest',
        '@nx/cypress',
        '@nx/playwright',
        '@nx/eslint',
      ],
    });
    ensurePlaywrightBrowsersInstallation();
    appPort = await reservePort();
    runCLI(
      `generate @nx/react:app ${appName} --use-react-router --routing --linter=eslint --unit-test-runner=vitest --e2e-test-runner=playwright --port=${appPort} --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('should generate a react-router application', async () => {
    const packageJson = JSON.parse(readFile('package.json'));
    expect(packageJson.dependencies['react-router']).toBeDefined();
    expect(packageJson.dependencies['@react-router/node']).toBeDefined();
    expect(packageJson.dependencies['@react-router/serve']).toBeDefined();
    expect(packageJson.dependencies['isbot']).toBeDefined();

    checkFilesExist(`${appName}/app/app.tsx`);
    checkFilesExist(`${appName}/app/entry.client.tsx`);
    checkFilesExist(`${appName}/app/entry.server.tsx`);
    checkFilesExist(`${appName}/app/routes.tsx`);
    checkFilesExist(`${appName}/react-router.config.ts`);
    checkFilesExist(`${appName}/vite.config.mts`);
  });

  it('should be able to build, lint, test and typecheck a react-router application', async () => {
    const buildResult = runCLI(`build ${appName}`);
    const lintResult = runCLI(`lint ${appName}`);
    const testResult = runCLI(`test ${appName}`);
    const typeCheckResult = runCLI(`typecheck ${appName}`);

    expect(buildResult).toContain('Successfully ran target build');
    expect(lintResult).toContain('Successfully ran target lint');
    expect(testResult).toContain('Successfully ran target test');
    expect(typeCheckResult).toContain('Successfully ran target typecheck');
  });
  it('should be able to test and typecheck a react-router application with jest', async () => {
    const jestApp = uniq('jestApp');
    runCLI(
      `generate @nx/react:app ${jestApp} --use-react-router --routing --unit-test-runner=jest --no-interactive`
    );

    const testResult = runCLI(`test ${jestApp}`);
    expect(testResult).toContain('Successfully ran target test');

    const typeCheckResult = runCLI(`typecheck ${jestApp}`);
    expect(typeCheckResult).toContain('Successfully ran target typecheck');
  });

  it('should execute e2e tests using playwright', async () => {
    if (await runE2ETests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project @proj/${appName}-e2e`
      );
      // Hygiene, not correctness: the reserved ports already keep the runs
      // apart, this just stops dev servers accumulating on the agent.
      expect(await killPorts(appPort)).toBeTruthy();
    }
  });

  it('should execute e2e tests using cypress', async () => {
    const cypressAppName = uniq('cypress-app');
    const cypressAppPort = await reservePort();
    await ensureCypressInstallation();
    runCLI(
      `generate @nx/react:app ${cypressAppName} --use-react-router --routing --linter=eslint --unit-test-runner=none --port=${cypressAppPort} --no-interactive`
    );
    if (await runE2ETests()) {
      const result = runCLI(`e2e ${cypressAppName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project @proj/${cypressAppName}-e2e`
      );
      expect(await killPorts(cypressAppPort)).toBeTruthy();
    }
  });
});
