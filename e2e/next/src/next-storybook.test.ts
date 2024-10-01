import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('Next.js Storybook', () => {
  const appName = uniq('app');
  beforeAll(() => {
    newProject({
      name: 'proj',
      packageManager: 'npm',
      packages: ['@nx/next', '@nx/react'],
    });
    runCLI(
      `generate @nx/next:app ${appName} --e2eTestRunner=none --no-interactive`
    );
    runCLI(
      `generate @nx/next:component ${appName}/components/foo/foo --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('should run a Next.js based Storybook setup', async () => {
    runCLI(
      `generate @nx/react:storybook-configuration ${appName} --no-interactive`
    );
    runCLI(`build-storybook ${appName}`);
    checkFilesExist(`${appName}/storybook-static/index.html`);
  }, 600_000);
});
