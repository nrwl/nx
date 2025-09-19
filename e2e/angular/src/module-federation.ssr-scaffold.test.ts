import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  killProcessAndPorts,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('Angular Module Federation - SSR scaffold', () => {
  beforeAll(() => newProject({ packages: ['@nx/angular'] }));
  afterAll(() => cleanupProject());

  it('should scaffold MF + SSR setup successfully', async () => {
    const host = uniq('host');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');

    runCLI(
      `generate @nx/angular:host ${host} --ssr --remotes=${remote1},${remote2} --no-interactive`
    );

    const hostPort = 4500;
    const remote1Port = readJson(join(remote1, 'project.json')).targets.serve
      .options.port;
    const remote2Port = readJson(join(remote2, 'project.json')).targets.serve
      .options.port;

    [host, remote1, remote2].forEach((app) => {
      checkFilesExist(
        `${app}/module-federation.config.ts`,
        `${app}/webpack.server.config.ts`
      );

      ['build', 'server'].forEach((target) => {
        ['development', 'production'].forEach(async (configuration) => {
          const cliOutput = runCLI(`run ${app}:${target}:${configuration}`);
          expect(cliOutput).toContain('Successfully ran target');

          await killPorts(readPort(app));
        });
      });
    });

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    updateFile(
      `${host}-e2e/src/example.spec.ts`,
      (_) => `import { test, expect } from '@playwright/test';
test('renders remotes', async ({ page }) => {
  await page.goto('/');

  // Expect the page to contain a specific text.
  // get ul li text
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
      await killProcessAndPorts(e2eProcess.pid);
    }
  }, 20_000_000);
});

function readPort(appName: string): number {
  let config;
  try {
    config = readJson(join('apps', appName, 'project.json'));
  } catch {
    config = readJson(join(appName, 'project.json'));
  }
  return config.targets.serve.options.port;
}


