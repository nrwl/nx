import { killPort, runCLI, runE2ETests, uniq } from '@nx/e2e-utils';

import { setupAngularProjectsSuite } from './projects.setup';

describe('Angular Projects - playwright', () => {
  setupAngularProjectsSuite();

  it('should successfully work with playwright for e2e tests', async () => {
    const app = uniq('app');

    runCLI(
      `generate @nx/angular:app ${app} --e2eTestRunner=playwright --no-interactive`
    );

    if (runE2ETests('playwright')) {
      expect(() => runCLI(`e2e ${app}-e2e`)).not.toThrow();
      expect(await killPort(4200)).toBeTruthy();
    }
  }, 1000000);
});
