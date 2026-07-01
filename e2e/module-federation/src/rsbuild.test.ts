import {
  checkFilesExist,
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';
import {
  cleanupModuleFederationV2Test,
  setupModuleFederationV2Test,
} from './setup';

describe('@nx/module-federation v2 - Rsbuild', () => {
  beforeAll(() => {
    setupModuleFederationV2Test();
  });

  afterAll(() => cleanupModuleFederationV2Test());

  it('generates an rsbuild provider that serves standalone', async () => {
    const provider = uniq('rsbuild-provider');
    const providerPort = 3101;

    runCLI(
      `generate @nx/react:provider apps/${provider} --bundler=rsbuild --port=${providerPort} --no-interactive --skipFormat`
    );

    checkFilesExist(
      `apps/${provider}/rsbuild.config.ts`,
      `apps/${provider}/index.html`,
      `apps/${provider}/src/index.ts`,
      `apps/${provider}/src/bootstrap.tsx`,
      `apps/${provider}/src/App.tsx`,
      `apps/${provider}/package.json`
    );

    if (runE2ETests()) {
      const serve = await runCommandUntil(
        `serve ${provider}`,
        (output) => output.includes('Local:'),
        { timeout: 180000 }
      );
      await killProcessAndPorts(serve.pid, providerPort);
    }
  }, 600_000);

  it('generates an rsbuild consumer + provider in one shot via --providerNames and wires the manifest', async () => {
    const consumer = uniq('rsbuild-consumer');
    const provider = uniq('rsbuild-provider');
    const consumerPort = 3100;
    const providerPort = 3101;

    runCLI(
      `generate @nx/react:consumer apps/${consumer} --bundler=rsbuild --providerNames=${provider} --no-interactive --skipFormat`
    );

    checkFilesExist(
      `apps/${consumer}/rsbuild.config.ts`,
      `apps/${consumer}/src/mf.ts`,
      `apps/${consumer}/src/App.tsx`,
      `apps/${provider}/rsbuild.config.ts`,
      `apps/${provider}/src/App.tsx`
    );

    if (runE2ETests()) {
      let consumerReady = false;
      let providerReady = false;
      const serve = await runCommandUntil(
        `serve ${provider}`,
        (output) => {
          if (output.includes(`http://localhost:${consumerPort}/`)) {
            consumerReady = true;
          }
          if (output.includes(`http://localhost:${providerPort}/`)) {
            providerReady = true;
          }
          return consumerReady && providerReady;
        },
        { timeout: 180000 }
      );
      await killProcessAndPorts(serve.pid, consumerPort, providerPort);
    }
  }, 900_000);
});
