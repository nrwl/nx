import {
  checkFilesExist,
  killPorts,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { join } from 'path';

import {
  readPort,
  setupModuleFederationSuite,
} from './module-federation.setup';

describe('Angular Module Federation - SSR scaffold', () => {
  setupModuleFederationSuite();

  it('should scaffold MF + SSR setup successfully', async () => {
    const host = uniq('host');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');

    runCLI(
      `generate @nx/angular:host ${host} --ssr --remotes=${remote1},${remote2} --no-interactive`
    );

    const hostPort = 4500;
    const remote1Port = readPort(remote1);
    const remote2Port = readPort(remote2);

    [host, remote1, remote2].forEach((app) => {
      checkFilesExist(
        `${app}/module-federation.config.ts`,
        `${app}/webpack.server.config.ts`
      );

      ['build', 'server'].forEach((target) => {
        ['development', 'production'].forEach((configuration) => {
          const cliOutput = runCLI(`run ${app}:${target}:${configuration}`);
          expect(cliOutput).toContain('Successfully ran target');

          killPorts(readPort(app));
        });
      });
    });

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    updateFile(
      `${host}-e2e/src/example.spec.ts`,
      (_) => `import { test, expect } from '@playwright/test';
test('renders remotes', async ({ page }) => {
  await page.goto('/');

  const items = page.locator('ul li');

  await items.nth(2).waitFor()
  expect(await items.count()).toEqual(3);
  expect(await items.nth(0).innerText()).toContain('Home');
  expect(await items.nth(1).innerText()).toContain('${capitalize(remote1)}');
  expect(await items.nth(2).innerText()).toContain('${capitalize(remote2)}');
});`
    );
    if (runE2ETests()) {
      const e2eProcess = await runCommandUntil(`e2e ${host}-e2e`, (output) =>
        output.includes(`Successfully ran target e2e for project ${host}-e2e`)
      );
      await killPorts(readPort(host));
    }
  }, 20_000_000);
});
