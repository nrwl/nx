import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('Nuxt Plugin', () => {
  const app = uniq('app');

  beforeAll(() => {
    newProject({
      packages: ['@nx/nuxt'],
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(
      `generate @nx/nuxt:app ${app} --unitTestRunner=vitest --projectNameAndRootFormat=as-provided`
    );
    runCLI(
      `generate @nx/nuxt:component --directory=${app}/src/components/one --name=one --nameAndDirectoryFormat=as-provided --unitTestRunner=vitest`
    );
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
    checkFilesExist(`dist/${app}/.nuxt/nuxt.d.ts`);
    checkFilesExist(`dist/${app}/.output/nitro.json`);
  });

  it('should test application', async () => {
    const result = runCLI(`test ${app}`);
    expect(result).toContain(`Successfully ran target test for project ${app}`);
  }, 150_000);

  it('should lint application', async () => {
    const result = runCLI(`lint ${app}`);
    expect(result).toContain(`Successfully ran target lint for project ${app}`);
  });

  it('should build storybook for app', () => {
    runCLI(
      `generate @nx/nuxt:storybook-configuration ${app} --generateStories --no-interactive`
    );
    runCLI(`run ${app}:build-storybook --verbose`);
    checkFilesExist(`${app}/storybook-static/index.html`);
  }, 300_000);
});
