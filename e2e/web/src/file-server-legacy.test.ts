import {
  cleanupProject,
  killPorts,
  newProject,
  promisifiedTreeKill,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e/utils';

describe('file-server', () => {
  beforeAll(() => {
    newProject({ name: uniq('fileserver') });
  });

  afterAll(() => cleanupProject());

  it('should setup and serve static files from app', async () => {
    const ngAppName = uniq('ng-app');
    const reactAppName = uniq('react-app');

    runCLI(
      `generate @nx/angular:app ${ngAppName} --no-interactive --e2eTestRunner=none`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );
    runCLI(
      `generate @nx/react:app ${reactAppName} --no-interactive --e2eTestRunner=none`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );
    runCLI(
      `generate @nx/web:static-config --buildTarget=${reactAppName}:build --targetName=custom-serve-static --no-interactive`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );

    const port = 6200;

    const ngServe = await runCommandUntil(
      `serve-static ${ngAppName} --port=${port}`,
      (output) => {
        return output.indexOf(`localhost:${port}`) > -1;
      }
    );

    try {
      await promisifiedTreeKill(ngServe.pid, 'SIGKILL');
      await killPorts(port);
    } catch {
      // ignore
    }

    const reactServe = await runCommandUntil(
      `custom-serve-static ${reactAppName} --port=${port + 1}`,
      (output) => {
        return output.indexOf(`localhost:${port + 1}`) > -1;
      }
    );

    try {
      await promisifiedTreeKill(reactServe.pid, 'SIGKILL');
      await killPorts(port + 1);
    } catch {
      // ignore
    }
  }, 300_000);
});
