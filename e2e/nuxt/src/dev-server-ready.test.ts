import {
  addReadyUrlCheck,
  cleanupProject,
  expectServedOn,
  newProject,
  reservePort,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Nuxt app dev-server readiness', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/nuxt', '@nx/vite'] });
  });

  afterAll(() => cleanupProject());

  it('should run a task that waits for the Nuxt dev server once it listens', async () => {
    const app = uniq('nuxt-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/nuxt:app apps/${app} --linter=none --unitTestRunner=none --e2eTestRunner=none --no-interactive`
    );
    updateFile(`apps/${app}/nuxt.config.ts`, (config) =>
      config.replace('port: 4200', `port: ${port}`)
    );
    addReadyUrlCheck(`apps/${app}`, 'serve');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);
});
