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
  let originalEnv: string;
  const app = uniq('app');

  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'true';
    proj = newProject({
      packages: ['@nx/nuxt', '@nx/storybook'],
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(`generate @nx/nuxt:app ${app} --unitTestRunner=vitest`);
    runCLI(
      `generate @nx/nuxt:component --directory=${app}/src/components/one --name=one --nameAndDirectoryFormat=as-provided --unitTestRunner=vitest`
    );
  });

  afterAll(() => {
    killPorts();
    cleanupProject();
    process.env.NX_ADD_PLUGINS = originalEnv;
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
