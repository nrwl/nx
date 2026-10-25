import {
  addReadyUrlCheck,
  cleanupProject,
  expectServedOn,
  newProject,
  reservePort,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

// The serve targets the bundler plugins infer are ready on the dev server's
// signal, which carries the address it listens on
describe('React app dev-server readiness', () => {
  beforeAll(() => {
    newProject({
      packages: [
        '@nx/react',
        '@nx/webpack',
        '@nx/rspack',
        '@nx/rsbuild',
        '@nx/vite',
        '@nx/vitest',
      ],
    });
  });

  afterAll(() => cleanupProject());

  it('should run a task that waits for the webpack dev server once it listens', async () => {
    const app = uniq('webpack-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/react:app apps/${app} --bundler=webpack --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(`apps/${app}`, 'serve');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);

  it('should run a task that waits for the vite dev server once it listens', async () => {
    const app = uniq('vite-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/react:app apps/${app} --bundler=vite --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(`apps/${app}`, 'dev');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);
  it('should run a task that waits for the rspack dev server once it listens', async () => {
    const app = uniq('rspack-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/react:app apps/${app} --bundler=rspack --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(`apps/${app}`, 'serve');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);

  it('should run a task that waits for the rsbuild dev server once it listens', async () => {
    const app = uniq('rsbuild-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/react:app apps/${app} --bundler=rsbuild --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(`apps/${app}`, 'dev');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);
});
