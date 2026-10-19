import {
  cleanupProject,
  killPorts,
  newProject,
  promisifiedTreeKill,
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
});
