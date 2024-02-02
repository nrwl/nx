import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e/utils';
import { ChildProcess } from 'child_process';

describe('Webpack Plugin (legacy)', () => {
  let originalAddPluginsEnv: string | undefined;
  const appName = uniq('app');
  const libName = uniq('lib');

  beforeAll(() => {
    originalAddPluginsEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    newProject({
      packages: ['@nx/react'],
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(
      `generate @nx/react:app ${appName} --bundler webpack --e2eTestRunner=cypress --rootProject --no-interactive`
    );
    runCLI(
      `generate @nx/react:lib ${libName} --unitTestRunner jest --no-interactive`
    );
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalAddPluginsEnv;
    cleanupProject();
  });

  it('should generate, build, and serve React applications and libraries', () => {
    expect(() => runCLI(`test ${appName}`)).not.toThrow();
    expect(() => runCLI(`test ${libName}`)).not.toThrow();

    // TODO: figure out why this test hangs in CI (maybe down to sudo prompt?)
    // expect(() => runCLI(`build ${appName}`)).not.toThrow();

    // if (runE2ETests()) {
    //   runCLI(`e2e ${appName}-e2e --watch=false --verbose`);
    // }
  }, 500_000);

  it('should run serve-static', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `serve-static ${appName} --port=${port}`,
        (output) => {
          return output.includes(`http://localhost:${port}`);
        }
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    if (process && process.pid) {
      await killProcessAndPorts(process.pid, port);
    }
  });
});
