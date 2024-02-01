import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e/utils';

describe('Web Components Applications with bundler set as webpack', () => {
  let originalEnv: string;

  beforeAll(async () => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
  });
  beforeEach(() =>
    newProject({
      packages: ['@nx/web'],
    })
  );
  afterEach(() => cleanupProject());

  it('should support https for dev-server', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`
    );

    const childProcess = await runCommandUntil(
      `serve ${appName} --port=5000 --ssl`,
      (output) => {
        return output.includes('listening at https://localhost:5000');
      }
    );

    await killProcessAndPorts(childProcess.pid, 5000);
  }, 300_000);
});
