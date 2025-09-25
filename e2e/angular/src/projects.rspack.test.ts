import {
  checkFilesDoNotExist,
  killPort,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';

import { setupAngularProjectsSuite } from './projects.setup';

describe('Angular Projects - rspack', () => {
  setupAngularProjectsSuite();

  it('should successfully work with rspack for build', async () => {
    const app = uniq('app');
    runCLI(
      `generate @nx/angular:app my-dir/${app} --bundler=rspack --no-interactive`
    );
    runCLI(`build ${app}`, {
      env: { NODE_ENV: 'production' },
    });

    if (runE2ETests()) {
      expect(() => runCLI(`e2e ${app}-e2e`)).not.toThrow();
      expect(await killPort(4200)).toBeTruthy();
    }
  }, 1000000);
});

