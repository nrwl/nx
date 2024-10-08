import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  readJson,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('Nuxt Plugin', () => {
  const app = uniq('app');

  beforeAll(() => {
    newProject({
      packages: ['@nx/nuxt'],
    });
    runCLI(
      `generate @nx/nuxt:app ${app} --unitTestRunner=vitest --e2eTestRunner=cypress`
    );
    runCLI(
      `generate @nx/nuxt:component ${app}/src/components/one/one --name=one --unitTestRunner=vitest`
    );
  });

  afterAll(() => {
    killPorts();
    cleanupProject();
  });

  it('should build application', async () => {
    expect(() => runCLI(`build ${app}`)).not.toThrow();
    checkFilesExist(`${app}/.nuxt/nuxt.d.ts`);
    checkFilesExist(`${app}/.output/nitro.json`);
  });

  it('should test application', async () => {
    expect(() => runCLI(`test ${app}`)).not.toThrow();
  }, 150_000);

  it('should lint application', async () => {
    expect(() => runCLI(`lint ${app}`)).not.toThrow();
  });

  it('should build storybook for app', () => {
    runCLI(
      `generate @nx/nuxt:storybook-configuration ${app} --generateStories --no-interactive`
    );
    runCLI(`run ${app}:build-storybook --verbose`);
    checkFilesExist(`${app}/storybook-static/index.html`);
  }, 300_000);

  it('should have build, serve, build-static, server-static targets', () => {
    runCLI(`show project ${app} --json > targets.json`);

    const targets = readJson('targets.json');
    expect(targets.targets['build']).toBeDefined();
    expect(targets.targets['serve']).toBeDefined();
    expect(targets.targets['serve-static']).toBeDefined();
    expect(targets.targets['build-static']).toBeDefined();
  });
});
