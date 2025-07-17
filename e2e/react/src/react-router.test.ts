import {
  checkFilesExist,
  cleanupProject,
  ensureCypressInstallation,
  ensurePlaywrightBrowsersInstallation,
  newProject,
  readFile,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

describe('React Router Applications', () => {
  describe('TS paths', () => {
    const appName = uniq('app');
    beforeAll(() => {
      newProject({ packages: ['@nx/react'] });
      ensurePlaywrightBrowsersInstallation();
      runCLI(
        `generate @nx/react:app ${appName} --use-react-router --routing --linter=eslint --unit-test-runner=vitest --e2e-test-runner=playwright --no-interactive`
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
      checkFilesExist(`${appName}/vite.config.ts`);
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

    it('should execute e2e tests using playwright', () => {
      if (runE2ETests()) {
        const result = runCLI(`e2e ${appName}-e2e --verbose`);
        expect(result).toContain(
          `Successfully ran target e2e for project ${appName}-e2e`
        );
      }
    });

    it('should execute e2e tests using cypress', () => {
      const cypressAppName = uniq('cypress-app');
      ensureCypressInstallation();
      runCLI(
        `generate @nx/react:app ${cypressAppName} --use-react-router --routing --linter=eslint --unit-test-runner=none  --no-interactive`
      );
      if (runE2ETests()) {
        const result = runCLI(`e2e ${cypressAppName}-e2e --verbose`);
        expect(result).toContain(
          `Successfully ran target e2e for project ${cypressAppName}-e2e`
        );
      }
    });
  });
  describe('TS Solution', () => {
    const appName = uniq('app');
    beforeAll(() => {
      newProject({ preset: 'ts', packages: ['@nx/react'] });
      ensurePlaywrightBrowsersInstallation();
      runCLI(
        `generate @nx/react:app ${appName} --use-react-router --routing --linter=eslint --unit-test-runner=vitest --e2e-test-runner=playwright --no-interactive`
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
      checkFilesExist(`${appName}/vite.config.ts`);
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

    it('should execute e2e tests using playwright', () => {
      if (runE2ETests()) {
        const result = runCLI(`e2e ${appName}-e2e --verbose`);
        expect(result).toContain(
          `Successfully ran target e2e for project ${appName}-e2e`
        );
      }
    });

    it('should execute e2e tests using cypress', () => {
      const cypressAppName = uniq('cypress-app');
      ensureCypressInstallation();
      runCLI(
        `generate @nx/react:app ${cypressAppName} --use-react-router --routing --linter=eslint --unit-test-runner=none  --no-interactive`
      );
      if (runE2ETests()) {
        const result = runCLI(`e2e ${cypressAppName}-e2e --verbose`);
        expect(result).toContain(
          `Successfully ran target e2e for project ${cypressAppName}-e2e`
        );
      }
    });
  });
});
