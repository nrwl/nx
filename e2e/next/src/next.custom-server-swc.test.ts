import { checkFilesExist, runCLI, uniq } from '@nx/e2e-utils';

import { setupNextSuite } from './next.setup';

describe('Next.js custom server (swc)', () => {
  setupNextSuite();

  it('should support --custom-server flag (swc)', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --custom-server --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`${appName}/server/main.ts`, `${appName}/.server.swcrc`);

    const result = runCLI(`build ${appName}`);

    checkFilesExist(`dist/${appName}-server/server/main.js`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 300_000);
});
