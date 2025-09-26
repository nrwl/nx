import { checkFilesExist, runCLI, uniq } from '@nx/e2e-utils';

import { setupNextSuite } from './next.setup';

describe('Next.js custom server (tsc)', () => {
  setupNextSuite();

  it('should support --custom-server flag (tsc)', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --swc=false --no-interactive --custom-server --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/server/main.ts`);

    const result = runCLI(`build ${appName}`);

    checkFilesExist(`dist/${appName}-server/server/main.js`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 300_000);
});
