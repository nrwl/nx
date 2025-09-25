import { getStrippedEnvironmentVariables, runCLI, runE2ETests, uniq } from '@nx/e2e-utils';

import { setupNextSuite } from './next.setup';

describe('Next.js e2e ci', () => {
  setupNextSuite();

  it('should run e2e-ci test', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --linter=eslint --unitTestRunner=jest`
    );

    if (runE2ETests('playwright')) {
      const e2eResults = runCLI(`e2e-ci ${appName}-e2e --verbose`, {
        verbose: true,
        env: {
          ...getStrippedEnvironmentVariables(),
          NX_SKIP_ATOMIZER_VALIDATION: 'true',
        },
      });
      expect(e2eResults).toContain(
        'Successfully ran target e2e-ci for project'
      );
    }
  }, 600_000);
});

