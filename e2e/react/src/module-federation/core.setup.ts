import {
  cleanupProject,
  getAvailablePort,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { stripIndents } from '@nx/devkit';

import { readPort } from './utils';

export function setupReactModuleFederationSuite() {
  beforeAll(() => {
    newProject({ packages: ['@nx/react', '@nx/webpack'] });
  });

  afterAll(() => cleanupProject());
}

export async function generateHostWithRemotes(options: {
  js: boolean;
  bundler?: 'webpack' | 'rspack';
  inAppsDir?: boolean;
}) {
  const shell = uniq('shell');
  const remote1 = uniq('remote1');
  const remote2 = uniq('remote2');
  const remote3 = uniq('remote3');
  const shellPort = await getAvailablePort();

  const prefix = options.inAppsDir ? 'apps/' : '';
  runCLI(
    `generate @nx/react:host ${prefix}${shell} --name=${shell} --remotes=${remote1},${remote2},${remote3} --devServerPort=${shellPort} --bundler=${
      options.bundler ?? 'webpack'
    } --e2eTestRunner=cypress --style=css --no-interactive --skipFormat --js=${
      options.js
    }`
  );

  return { shell, remote1, remote2, remote3, shellPort };
}

export function updateCypressSpecs(
  shell: string,
  remotes: string[],
  js: boolean
) {
  updateFile(
    `${shell}-e2e/src/integration/app.spec.${js ? 'js' : 'ts'}`,
    stripIndents`
        import { getGreeting } from '../support/app.po';

        describe('shell app', () => {
          it('should display welcome message', () => {
            cy.visit('/')
            getGreeting().contains('Welcome ${shell}');
          });

          it('should load remote 1', () => {
            cy.visit('/${remotes[0]}')
            getGreeting().contains('Welcome ${remotes[0]}');
          });

          it('should load remote 2', () => {
            cy.visit('/${remotes[1]}')
            getGreeting().contains('Welcome ${remotes[1]}');
          });

          it('should load remote 3', () => {
            cy.visit('/${remotes[2]}')
            getGreeting().contains('Welcome ${remotes[2]}');
          });
        });
      `
  );
}

export async function runCypressE2E(shell: string) {
  if (!runE2ETests()) {
    return;
  }

  const serveResult = await runCommandUntil(`serve ${shell}`, (output) =>
    output.includes(`http://localhost:${readPort(shell)}`)
  );
  await killProcessAndPorts(serveResult.pid, readPort(shell));

  const e2eResultsSwc = await runCommandUntil(
    `e2e ${shell}-e2e --no-watch --verbose`,
    (output) => output.includes('All specs passed!')
  );
  await killProcessAndPorts(e2eResultsSwc.pid, readPort(shell));

  const e2eResultsTsNode = await runCommandUntil(
    `e2e ${shell}-e2e --no-watch --verbose`,
    (output) => output.includes('Successfully ran target e2e for project'),
    {
      env: { NX_PREFER_TS_NODE: 'true' },
    }
  );
  await killProcessAndPorts(e2eResultsTsNode.pid, readPort(shell));
}

export function generatePlaywrightHost(options: {
  shell: string;
  remotes: string[];
  bundler: 'webpack' | 'rspack';
  inAppsDir?: boolean;
}) {
  const prefix = options.inAppsDir ? 'apps/' : '';
  runCLI(
    `generate @nx/react:host ${prefix}${options.shell} --name=${
      options.shell
    } --remotes=${options.remotes.join(',')} --bundler=${
      options.bundler
    } --e2eTestRunner=playwright --style=css --no-interactive --skipFormat`
  );
}

export function updatePlaywrightSpec(shell: string, remotes: string[]) {
  updateFile(
    `apps/${shell}-e2e/src/example.spec.ts`,
    stripIndents`
          import { test, expect } from '@playwright/test';
          test('should display welcome message', async ({page}) => {
            await page.goto("/");
            expect(await page.locator('h1').innerText()).toContain('Welcome');
          });

          test('should load remote 1', async ({page}) => {
            await page.goto("/${remotes[0]}");
            expect(await page.locator('h1').innerText()).toContain('${remotes[0]}');
          });

          test('should load remote 2', async ({page}) => {
            await page.goto("/${remotes[1]}");
            expect(await page.locator('h1').innerText()).toContain('${remotes[1]}');
          });

          test('should load remote 3', async ({page}) => {
            await page.goto("/${remotes[2]}");
            expect(await page.locator('h1').innerText()).toContain('${remotes[2]}');
          });
      `
  );
}

export async function runPlaywrightE2E(shell: string) {
  if (!runE2ETests()) {
    return;
  }

  const e2eProcess = await runCommandUntil(`e2e ${shell}-e2e`, (output) =>
    output.includes('Successfully ran target e2e for project')
  );

  await killProcessAndPorts(e2eProcess.pid, readPort(shell));
}

export function updateWebpackRemoteEntry(shell: string, remoteEntry: string) {
  updateFile(`apps/${shell}/webpack.config.prod.ts`, (content) =>
    content.replace(`'http://localhost:4201/'`, `'${remoteEntry}'`)
  );
}

export function readMfManifest(shell: string) {
  return readJson(`dist/apps/${shell}/mf-manifest.json`);
}

export async function generateSSRHost(
  bundler: 'webpack' | 'rspack' = 'webpack'
) {
  const shell = uniq('shell');
  const remote1 = uniq('remote1');
  const remote2 = uniq('remote2');
  const remote3 = uniq('remote3');

  await runCLIAsync(
    `generate @nx/react:host ${shell} --bundler=${bundler} --ssr --remotes=${remote1},${remote2},${remote3} --style=css --no-interactive --skipFormat`
  );

  return { shell, remote1, remote2, remote3 };
}

export function regenerateMFManifest(shell: string, value: string) {
  updateFile(`apps/${shell}/webpack.config.prod.ts`, (content) =>
    content.replace(/'http:\/\/localhost:4201[^']*'/, `'${value}'`)
  );
}

export function setupServeHostWithDevRemotes(shell: string, remote: string) {
  return runCommandUntil(
    `serve ${shell} --devRemotes=${remote} --verbose`,
    (output) =>
      output.includes(
        `All remotes started, server ready at http://localhost:${readPort(
          shell
        )}`
      )
  );
}
