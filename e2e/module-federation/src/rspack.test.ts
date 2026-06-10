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

describe('@nx/module-federation v2 - Rspack', () => {
  beforeAll(() => {
    setupModuleFederationV2Test();
  });

  afterAll(() => cleanupModuleFederationV2Test());

  it('generates an rspack provider that serves standalone', async () => {
    const provider = uniq('rspack-provider');
    const providerPort = 8101;

    runCLI(
      `generate @nx/react:provider apps/${provider} --bundler=rspack --port=${providerPort} --no-interactive --skipFormat`
    );

    checkFilesExist(
      `apps/${provider}/rspack.config.ts`,
      `apps/${provider}/index.html`,
      `apps/${provider}/src/index.ts`,
      `apps/${provider}/src/bootstrap.tsx`,
      `apps/${provider}/src/App.tsx`,
      `apps/${provider}/package.json`
    );

    if (runE2ETests()) {
      const serve = await runCommandUntil(
        `serve ${provider}`,
        (output) =>
          output.includes('compiled successfully') ||
          output.includes('Compiled successfully'),
        { timeout: 240000 }
      );
      await killProcessAndPorts(serve.pid, providerPort);
    }
  }, 600_000);

  it('generates an rspack consumer + provider in one shot via --providerNames and wires the manifest', async () => {
    const consumer = uniq('rspack-consumer');
    const provider = uniq('rspack-provider');
    const consumerPort = 8100;
    const providerPort = 8101;

    runCLI(
      `generate @nx/react:consumer apps/${consumer} --bundler=rspack --providerNames=${provider} --no-interactive --skipFormat`
    );

    checkFilesExist(
      `apps/${consumer}/rspack.config.ts`,
      `apps/${consumer}/src/mf.ts`,
      `apps/${consumer}/src/App.tsx`,
      `apps/${provider}/rspack.config.ts`,
      `apps/${provider}/src/App.tsx`
    );

    if (runE2ETests()) {
      // `nx serve <provider>` brings the consumer up via provider.serve.dependsOn.
      // Both apps compile separately; wait for both compile-success messages.
      let compileCount = 0;
      const serve = await runCommandUntil(
        `serve ${provider}`,
        (output) => {
          const matches = output.match(/compiled successfully/gi);
          if (matches) compileCount = matches.length;
          return compileCount >= 2;
        },
        { timeout: 300000 }
      );
      await killProcessAndPorts(serve.pid, consumerPort, providerPort);
    }
  }, 900_000);
});
