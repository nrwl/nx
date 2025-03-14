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
  beforeAll(() => {
    newProject({ packages: ['@nx/react'] });
    ensureCypressInstallation();
  });

  afterAll(() => cleanupProject());

  it('should generate a react-router application', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/react:app ${appName} --use-react-router --routing --no-interactive`
    );

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
    const appName = uniq('app');
    runCLI(
      `generate @nx/react:app ${appName} --use-react-router --routing --no-interactive`
    );

    const buildResult = runCLI(`build ${appName}`);
    expect(buildResult).toContain('Successfully ran target build');
  });

  it('should be able to lint a react-router application', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/react:app ${appName} --use-react-router --routing --linter=eslint --no-interactive`
    );

    const buildResult = runCLI(`lint ${appName}`);
    expect(buildResult).toContain('Successfully ran target lint');
  });

  it('should be able to test a react-router application', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/react:app ${appName} --use-react-router --routing --unit-test-runner=vitest --no-interactive`
    );

    const buildResult = runCLI(`test ${appName}`);
    expect(buildResult).toContain('Successfully ran target test');
  });
});
