import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  reservePort,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e-utils';

describe('Web Components Applications with bundler set as webpack', () => {
  beforeEach(() => newProject({ packages: ['@nx/web'] }));
  afterEach(() => cleanupProject());

  it('should support https for dev-server (legacy)', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );

    const port = await reservePort();
    const childProcess = await runCommandUntil(
      `serve ${appName} --port=${port} --ssl`,
      (output) => {
        return output.includes(`listening at https://localhost:${port}`);
      }
    );

    await killProcessAndPorts(childProcess.pid, port);
  }, 300_000);
});
