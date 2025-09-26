import { checkFilesExist, runCLIAsync } from '@nx/e2e-utils';

import {
  generatePlaywrightHost,
  runPlaywrightE2E,
  setupReactModuleFederationSuite,
  updatePlaywrightSpec,
} from './core.setup';

describe('React Module Federation - playwright e2e', () => {
  setupReactModuleFederationSuite();

  it('should generate host and remote apps and use playwright for e2es', async () => {
    const shell = 'shell';
    const remote1 = 'remote1';
    const remote2 = 'remote2';
    const remote3 = 'remote3';

    generatePlaywrightHost({
      shell,
      remotes: [remote1, remote2, remote3],
      bundler: 'webpack',
      inAppsDir: true,
    });

    checkFilesExist(`apps/${shell}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote1}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote2}/module-federation.config.ts`);
    checkFilesExist(`apps/${remote3}/module-federation.config.ts`);

    await expect(runCLIAsync(`test ${shell}`)).resolves.toMatchObject({
      combinedOutput: expect.stringContaining('Test Suites: 1 passed, 1 total'),
    });

    updatePlaywrightSpec(shell, [remote1, remote2, remote3]);

    await runPlaywrightE2E(shell);
  }, 500_000);
});
