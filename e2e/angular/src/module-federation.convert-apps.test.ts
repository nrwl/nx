import {
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e-utils';

import { setupModuleFederationSuite } from './module-federation.setup';

describe('Angular Module Federation - convert apps', () => {
  setupModuleFederationSuite();

  it('should convert apps to MF successfully', async () => {
    const app1 = uniq('app1');
    const app2 = uniq('app2');
    const app1Port = 4400;
    const app2Port = 4401;

    runCLI(
      `generate @nx/angular:application ${app1} --routing --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:application ${app2} --bundler=webpack --no-interactive`
    );

    runCLI(
      `generate @nx/angular:setup-mf ${app1} --mfType=host --port=${app1Port} --no-interactive`
    );
    runCLI(
      `generate @nx/angular:setup-mf ${app2} --mfType=remote --host=${app1} --port=${app2Port} --no-interactive`
    );

    const processSwc = await runCommandUntil(
      `serve ${app1} --dev-remotes=${app2}`,
      (output) =>
        !output.includes(`Remote '${app2}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${app1Port}`)
    );

    await killProcessAndPorts(processSwc.pid, app1Port, app2Port);

    const processTsNode = await runCommandUntil(
      `serve ${app1} --dev-remotes=${app2}`,
      (output) =>
        !output.includes(`Remote '${app2}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${app1Port}`),
      { env: { NX_PREFER_TS_NODE: 'true' } }
    );

    await killProcessAndPorts(processTsNode.pid, app1Port, app2Port);
  }, 20_000_000);
});

