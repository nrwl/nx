import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('Nuxt Plugin', () => {
  let proj: string;
  const app = uniq('app');

  beforeAll(() => {
    proj = newProject({
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(`generate @nx/nuxt:app ${app} --unitTestRunner=none`);
  });

  afterAll(() => {
    killPorts();
    cleanupProject();
  });

  it('should build application', async () => {
    const result = runCLI(`build ${app}`);
    expect(result).toContain(
      `Successfully ran target build for project ${app}`
    );
  });

  it('should build storybook for app', () => {
    runCLI(
      `generate @nx/vue:storybook-configuration ${app} --generateStories --no-interactive`
    );
    runCLI(`run ${app}:build-storybook --verbose`);
    checkFilesExist(`dist/storybook/${app}/index.html`);
  }, 300_000);
});
