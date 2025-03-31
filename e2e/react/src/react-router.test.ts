import {
  checkFilesExist,
  cleanupProject,
  ensureCypressInstallation,
  newProject,
  readFile,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('React Router Applications', () => {
  describe('TS paths', () => {
    const appName = uniq('app');
    beforeAll(() => {
      newProject({ packages: ['@nx/react'] });
      ensureCypressInstallation();
      runCLI(
        `generate @nx/react:app ${appName} --use-react-router --routing --linter=eslint --unit-test-runner=vitest --no-interactive`
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

    it('should be able to build a react-router application', async () => {
      const buildResult = runCLI(`build ${appName}`);
      expect(buildResult).toContain('Successfully ran target build');
    });

    it('should be able to lint a react-router application', async () => {
      const lintResult = runCLI(`lint ${appName}`);
      expect(lintResult).toContain('Successfully ran target lint');
    });

    it('should be able to test and typecheck a react-router application', async () => {
      const typeCheckResult = runCLI(`typecheck ${appName}`);
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
  });
  describe('TS Solution', () => {
    const appName = uniq('app');
    beforeAll(() => {
      newProject({ preset: 'ts', packages: ['@nx/react'] });
      ensureCypressInstallation();
      runCLI(
        `generate @nx/react:app ${appName} --use-react-router --routing --linter=eslint --unit-test-runner=vitest --no-interactive`
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

    it('should be able to build a react-router application', async () => {
      const buildResult = runCLI(`build ${appName}`);
      expect(buildResult).toContain('Successfully ran target build');
    });

    it('should be able to lint a react-router application', async () => {
      const lintResult = runCLI(`lint ${appName}`);
      expect(lintResult).toContain('Successfully ran target lint');
    });

    it('should be able to test and typecheck a react-router application', async () => {
      const testResult = runCLI(`test ${appName}`);
      expect(testResult).toContain('Successfully ran target test');

      const typeCheckResult = runCLI(`typecheck ${appName}`);
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
  });
});
