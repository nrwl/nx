import {
  addReadyUrlCheck,
  cleanupProject,
  expectServedOn,
  killPorts,
  newProject,
  promisifiedTreeKill,
  reservePort,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e-utils';

describe('file-server', () => {
  beforeAll(() => {
    newProject({
      name: uniq('fileserver'),
      packages: ['@nx/web', '@nx/angular'],
    });
  });

  afterAll(() => cleanupProject());

  it('should serve static files from an app', async () => {
    const ngAppName = uniq('ng-app');
    runCLI(
      `generate @nx/angular:app ${ngAppName} --no-interactive --e2eTestRunner=none`
    );

    const port = 6200;
    const ngServe = await runCommandUntil(
      `serve-static ${ngAppName} --port=${port}`,
      (output) => output.indexOf(`localhost:${port}`) > -1
    );

    try {
      await promisifiedTreeKill(ngServe.pid, 'SIGKILL');
      await killPorts(port);
    } catch {
      // ignore
    }
  }, 300_000);

  it('should run a task that waits for the file server once it listens', async () => {
    const app = uniq('ng-app');
    const port = await reservePort();
    runCLI(
      `generate @nx/angular:app apps/${app} --linter=none --unitTestRunner=none --e2eTestRunner=none --port=${port} --no-interactive`
    );
    addReadyUrlCheck(`apps/${app}`, 'serve-static');

    const output = runCLI(`run ${app}:check`);
    expectServedOn(output, port);
    expect(output).toContain(
      `Successfully ran target check for project ${app}`
    );
  }, 300_000);
});
