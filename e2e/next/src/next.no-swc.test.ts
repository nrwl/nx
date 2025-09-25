import { checkFilesExist, runCLI, uniq } from '@nx/e2e-utils';

import { setupNextSuite } from './next.setup';
import { checkApp } from './utils';

describe('Next.js no swc', () => {
  setupNextSuite();

  it('should support --no-swc flag', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --no-swc --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/.babelrc`);

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: false,
      checkE2E: false,
    });
  }, 300_000);
});
