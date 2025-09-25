import { checkFilesExist, runCLI, runCLIAsync } from '@nx/e2e-utils';

import {
  generateHostWithRemotes,
  runCypressE2E,
  setupReactModuleFederationSuite,
  updateCypressSpecs,
} from './core.setup';

describe('React Rspack Module Federation - host/remote generation', () => {
  setupReactModuleFederationSuite();

  it.each`
    js
    ${false}
    ${true}
  `('should generate host and remote apps with "--js=$js"', async ({ js }) => {
    const { shell, remote1, remote2, remote3 } = await generateHostWithRemotes({
      js,
      bundler: 'rspack',
      inAppsDir: true,
    });

    checkFilesExist(
      `apps/${shell}/module-federation.config.${js ? 'js' : 'ts'}`,
      `apps/${remote1}/module-federation.config.${js ? 'js' : 'ts'}`,
      `apps/${remote2}/module-federation.config.${js ? 'js' : 'ts'}`,
      `apps/${remote3}/module-federation.config.${js ? 'js' : 'ts'}`
    );

    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    updateCypressSpecs(shell, [remote1, remote2, remote3], js);

    [shell, remote1, remote2, remote3].forEach((app) => {
      ['development', 'production'].forEach((configuration) => {
        const cliOutput = runCLI(`run ${app}:build:${configuration}`);
        expect(cliOutput).toContain('Successfully ran target');
      });
    });

    await runCypressE2E(shell);
  }, 500_000);
});

